import { BaseCommand, checkExists, deepMergeWithArrayOverwrite, LogLevels, readFile, readRaw, writeFile } from '@cenk1cenk2/boilerplate-oclif'
import { pipeProcessToLogger } from '@utils/pipe-through-logger'
import { transformAndValidate } from 'class-transformer-validator'
import config from 'config'
import execa from 'execa'
import fs from 'fs-extra'
import { EOL } from 'os'
import { join, normalize } from 'path'
import { v4 as uuid } from 'uuid'

import 'reflect-metadata'
import { InitCtx } from '@interfaces/commands/init.interface'
import { SERVICE_EXTENSION_ENVIRONMENT_VARIABLES } from '@src/constants/environment-variables.constants'
import {
  CONFIG_FILES,
  CONTAINER_ENV_FILE,
  CONTAINER_LOCK_FILE,
  MOUNTED_CONFIG_PATH,
  MOUNTED_DATA_FOLDER,
  S6_FOLDERS,
  TEMPLATES,
  TEMPLATE_FOLDER
} from '@src/constants/file-system.constants'
import { DockerService, DockerServicesConfig } from '@src/interfaces/configs/docker-services.interface'
import { createEnvFile } from '@src/utils/env-file'
import { jinja } from '@src/utils/jinja'

export default class Init extends BaseCommand {
  static description = 'This command initiates the container and creates the required variables.'

  public async construct (): Promise<void> {
    this.tasks.options = {
      rendererSilent: true
    }
  }

  public async run (): Promise<void> {
    this.tasks.add<InitCtx>([
      // set defaults for context
      {
        task: async (ctx): Promise<void> => {
          ctx.fileSystem = {
            config: join(this.config.root, 'config', CONFIG_FILES.index),
            templates: join(this.config.root, TEMPLATE_FOLDER)
          }

          this.logger.debug('Set defaults for context: %o', ctx, { context: 'context' })
        }
      },

      // loads the default configuration
      {
        task: async (ctx): Promise<void> => {
          this.logger.verbose('Loading default configuration.', { custom: 'defaults' })

          ctx.config = config.util.parseFile(join(ctx.fileSystem.config, 'default.yml'))

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { services: omit, ...rest } = ctx.config

          this.logger.debug('Configuration file defaults are loaded: %o', rest, { custom: 'defaults' })
        }
      },

      // check if configuration loaded to the expected directory
      {
        skip: (): boolean => {
          if (checkExists(normalize(MOUNTED_CONFIG_PATH))) {
            return false
          } else {
            this.logger.warn(`Mounted configuration file not found at "${MOUNTED_CONFIG_PATH}", skipping merge.`, { custom: 'config' })

            return true
          }
        },
        task: async (ctx): Promise<void> => {
          ctx.config = deepMergeWithArrayOverwrite(ctx.config, await readFile(normalize(MOUNTED_CONFIG_PATH)))

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { services: omit, ...rest } = ctx.config

          this.logger.debug('Merged mounted configuration to defaults: %o', rest, { custom: 'config' })

          this.logger.module(`Extended defaults with configuration file found at "${MOUNTED_CONFIG_PATH}".`, { custom: 'config' })
        }
      },

      // extend configuration with environment variables
      {
        task: (ctx): void => {
          const envVars = config.util.getCustomEnvVars<DockerServicesConfig>(ctx.fileSystem.config, [ 'yml' ])

          if (Object.keys(envVars).length > 0) {
            ctx.config = deepMergeWithArrayOverwrite(ctx.config, envVars)

            this.logger.debug('Merged environment variables: %o', envVars, { custom: 'environment' })

            this.logger.module('Extended defaults with environment variables.', { custom: 'environment' })
          }
        }
      },

      // extend configuration with services environment variables
      {
        task: (ctx): void => {
          const servicesFromEnvVars = this.getEnvVariablesForService(ctx.config)

          if (Object.keys(servicesFromEnvVars).length > 0) {
            Object.entries(servicesFromEnvVars).forEach(([ i, value ]) => {
              ctx.config.services[i] = deepMergeWithArrayOverwrite(ctx.config?.services?.[i], value)

              this.logger.debug(`Merged environment for service ${i}: %o`, ctx.config.services[i], { custom: 'environment' })
            })

            this.logger.module('Extended %i services from environment variables.', Object.keys(servicesFromEnvVars).length, { custom: 'environment' })
          } else {
            this.logger.warn('No environment variables with "SERVICE_*" found to extend the services from, skipping merge.', { custom: 'environment' })
          }
        }
      },

      {
        task: (ctx): void => {
          ctx.config.services = ctx.config.services.map((service) => {
            return deepMergeWithArrayOverwrite(ctx.config.defaults, service) as DockerService
          })

          this.logger.debug('Merged default configuration to all services: %o', ctx.config.defaults, { context: 'DEFAULTS' })
        }
      },

      // normalize variables
      {
        task: async (ctx): Promise<void> => {
          // service names
          await Promise.all(
            ctx.config.services.map(async (service) => {
              service.id = uuid()
              service.name = service.name ?? service.cwd

              // we wrap this inside "" so have to escape it all
              service.parsed_command = service.command.replaceAll('"', '\\"')

              if (Array.isArray(service.before) && service.before.length > 0) {
                service.before = service.before.map((b) => b.replaceAll('"', '\\"'))
              }

              if (service.environment && Object.keys(service.environment).length > 0) {
                service.parsed_environment = Object.entries(service.environment).reduce((o, [ envKey, envValue ]) => o + `export ${envKey}=${envValue}` + EOL, '')
              }
            })
          )

          this.logger.debug('Services discovered: %o', ctx.config.services, { custom: 'services' })
        }
      },

      // validate all variables
      {
        task: async (ctx): Promise<void> => {
          try {
            ctx.config = await transformAndValidate(DockerServicesConfig, ctx.config, {
              validator: {
                skipMissingProperties: true,
                whitelist: false,
                always: true,
                enableDebugMessages: true
              },
              transformer: { enableImplicitConversion: true }
            })

            this.logger.debug('Validation succeeded.', { context: 'validation' })
          } catch (e) {
            this.logger.fatal('Given configuration is not valid: %o', e, { context: 'validation' })

            process.exit(120)
          }
        }
      },

      // initiate fnm version
      {
        skip: (ctx): boolean => ctx.config.node_version === 'default',
        task: async (ctx): Promise<void> => {
          this.logger.module('Installing node version given from variables: %s', ctx.config.node_version, { custom: 'node' })

          try {
            await pipeProcessToLogger.bind(this)({
              instance: execa('fnm', [ 'install', ctx.config.node_version ], {
                shell: '/bin/bash',
                detached: false,
                extendEnv: false
              }),
              options: { meta: [ { custom: 'fnm', trimEmptyLines: true } ] }
            })
          } catch (e) {
            this.logger.fatal('Can not use the given version with FNM.', { custom: 'fnm' })

            this.logger.error('%o', e, { custom: 'fnm' })

            process.exit(120)
          }
        }
      },

      // load fnm version from the root of the thingy
      {
        skip: (ctx): boolean =>
          ctx.config.node_version === 'default' && !checkExists(join(MOUNTED_DATA_FOLDER, '.nvmrc')) && !checkExists(join(MOUNTED_DATA_FOLDER, '.node-version')),
        task: async (): Promise<void> => {
          this.logger.module('Found node version override file in the root directory of the data folder.', { custom: 'node' })

          try {
            await pipeProcessToLogger.bind(this)({
              instance: execa('fnm', [ 'install' ], {
                shell: '/bin/bash',
                detached: false,
                extendEnv: false,
                cwd: MOUNTED_DATA_FOLDER
              }),
              options: { meta: [ { custom: 'fnm', trimEmptyLines: true } ] }
            })
          } catch (e) {
            this.logger.fatal('Can not use the workspace version with FNM.', { custom: 'fnm' })

            this.logger.error('%o', e, { custom: 'fnm' })

            process.exit(120)
          }
        }
      },

      // check all the given cwds exists
      {
        skip: (ctx): boolean => !ctx.config.check_directories,
        task: async (ctx): Promise<void> => {
          const errors: string[] = []

          await Promise.all(
            ctx.config.services.map(async (service, i) => {
              const dir = join(MOUNTED_DATA_FOLDER, service.cwd)

              try {
                const stat = fs.statSync(dir)

                if (!stat.isDirectory()) {
                  errors.push(`Specified directory "${dir}" is not a directory for service ${i}.`)
                }
              } catch {
                errors.push(`Specified directory "${dir}" does not exists for service ${i}.`)
              }
            })
          )

          if (errors.length > 0) {
            errors.forEach((error) => this.logger.fatal(error, { custom: 'services' }))

            process.exit(120)
          }
        }
      },

      // clean prior instance
      {
        task: async (): Promise<void> => {
          await Promise.all([ S6_FOLDERS.service, CONTAINER_ENV_FILE, CONTAINER_LOCK_FILE ].map((f) => fs.remove(f)))

          await fs.mkdirp(S6_FOLDERS.service)
        }
      },

      // init variables for s6
      {
        task: async (ctx): Promise<void> => {
          await createEnvFile(CONTAINER_ENV_FILE, {
            PACKAGE_MANAGER: ctx.config.package_manager,
            FORCE_INSTALL: ctx.config.force_install,
            NODE_VERSION: ctx.config.node_version
          })

          switch (this.constants.loglevel) {
          case LogLevels.debug:
            await createEnvFile(CONTAINER_ENV_FILE, { LOG_LEVEL: 5 }, true)
            break
          default:
            await createEnvFile(CONTAINER_ENV_FILE, { LOG_LEVEL: 4 }, true)
          }
        }
      },

      // init services for s6 supervisor
      {
        task: async (ctx): Promise<void> => {
          const enabled = ctx.config.services.filter((service) => service.enable === true)
          const disabled = ctx.config.services.filter((service) => service.enable === false)
          const preliminary = enabled.filter((service) => service.sync === true)

          if (disabled.length > 0) {
            this.logger.warn('Some services are disabled by configuration: %s', disabled.map((d) => d.cwd).join(', '), { context: 'services' })
          }

          if (preliminary.length > 0) {
            await createEnvFile(CONTAINER_LOCK_FILE, { PRELIMINARY_SERVICES: `(${preliminary.map((s) => s.id).join(' ')})`, FIRST_SERVICE: true })

            this.logger.debug('Wrote lock file for preliminary services.', { custom: 'preliminary-services' })
          }

          if (enabled.length < 1) {
            this.logger.fatal('No service is enabled at the moment. Please check the configuration.')

            process.exit(120)
          }

          await this.createRunScriptForService(ctx, enabled)
        }
      },

      // run pre scripts
      {
        skip: (ctx): boolean => !ctx.config.before_all,
        task: async (ctx): Promise<void> => {
          this.logger.info('before_all is defined, running commands before starting services.', { custom: 'before-all' })

          for (const command of ctx.config.before_all as string[]) {
            this.logger.info(`$ ${command}`, { custom: 'before-all' })

            await pipeProcessToLogger.bind(this)({
              instance: execa.command(command, {
                shell: '/bin/bash',
                detached: false,
                extendEnv: false,
                cwd: MOUNTED_DATA_FOLDER
              }),
              options: { meta: [ { custom: 'before-all', trimEmptyLines: true } ] }
            })
          }
        }
      }
    ])
  }

  private async createRunScriptForService (ctx: InitCtx, services: DockerService[]): Promise<void> {
    const runTemplatePath = join(ctx.fileSystem.templates, TEMPLATES.run)
    const runTemplate = await readRaw(runTemplatePath)
    const finishTemplatePath = join(ctx.fileSystem.templates, TEMPLATES.finish)
    const finishTemplate = await readRaw(finishTemplatePath)

    await Promise.all(
      services.map(async (service) => {
        const runScriptTemplate = jinja(ctx.fileSystem.templates).renderString(runTemplate, { service, config: ctx.config })
        const finishScriptTemplate = jinja(ctx.fileSystem.templates).renderString(finishTemplate, { service, config: ctx.config })

        const serviceDir = join(S6_FOLDERS.service, service.id)
        const runScriptPath = join(serviceDir, S6_FOLDERS.runScriptName)
        const finishScriptPath = join(serviceDir, S6_FOLDERS.finishScriptName)

        await fs.mkdirp(serviceDir)

        await Promise.all([ writeFile(runScriptPath, runScriptTemplate), writeFile(finishScriptPath, finishScriptTemplate) ])

        await Promise.all([ fs.chmod(runScriptPath, '0777'), fs.chmod(finishScriptPath, '0777') ])

        this.logger.debug('Initiated service scripts for "%s" in directory: %s', service.cwd, serviceDir, { context: 'services' })
      })
    )
  }

  private getEnvVariablesForService (base: DockerServicesConfig): Record<number, DockerService> {
    const timeout = 60000
    const startedAt = Date.now()
    const services: Record<number, DockerService> = {}

    for (let i = 0; i < Infinity; i++) {
      if (Date.now() - startedAt > timeout) {
        this.logger.fatal('Creating new services through environment variables has timed-out.', { custom: 'environment' })

        throw new Error(`Timed-out in ${timeout}ms.`)
      }

      // check if variables required for a service exists
      const required = SERVICE_EXTENSION_ENVIRONMENT_VARIABLES.filter((variable) => variable.required)

      let shouldBreak: boolean
      required.forEach((variable) => {
        if (!process.env[`SERVICE_${i}_${variable.name}`] && !base.services?.[i]?.[variable.key]) {
          this.logger.verbose(`Required environment variable not found for service ${i}: "${variable.name}" with config key "${variable.key}"`, { custom: 'environment' })

          shouldBreak = true
        }
      })

      if (shouldBreak) {
        break
      }

      const service = {}

      SERVICE_EXTENSION_ENVIRONMENT_VARIABLES.forEach((variable) => {
        const name = `SERVICE_${i}_${variable.name}`
        const env = process.env[name]

        if (env) {
          if (variable.parser === 'json') {
            try {
              service[variable.key] = JSON.parse(env)
            } catch (e) {
              this.logger.fatal(`Given variable "${name}" was supposed to be a valid stringified JSON.`, { custom: 'environment' })

              throw e
            }
          } else if (typeof variable.parser === 'function') {
            service[variable.key] = variable.parser(env, name)
          } else {
            service[variable.key] = String(env)
          }
        }
      })

      if (Object.keys(service).length > 0) {
        this.logger.verbose(`Service ${i} extended with environment variables: %o`, service, { custom: 'environment' })

        services[i] = service as DockerService
      }
    }

    return services
  }
}
