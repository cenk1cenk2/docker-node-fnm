import execa from 'execa'
import { EOL } from 'os'
import { join, normalize } from 'path'
import { v4 as uuid } from 'uuid'

import { Command, config, fs, Logger, LogLevels, merge, MergeStrategy, pipeProcessToLogger } from '@cenk1cenk2/oclif-common'
import { SERVICE_EXTENSION_ENVIRONMENT_VARIABLES } from '@constants/environment-variables.constants'
import {
  CONFIG_FILES,
  CONTAINER_ENV_FILE,
  CONTAINER_LOCK_FILE,
  DEFAULT_CONFIG_FILE,
  MOUNTED_CONFIG_PATH,
  MOUNTED_DATA_FOLDER,
  S6_FOLDERS,
  TEMPLATES,
  TEMPLATE_FOLDER,
  YAML_FILE_EXT
} from '@constants/file-system.constants'
import type { InitCtx } from '@interfaces/commands/init.interface'
import type { DockerService } from '@interfaces/configs/docker-services.interface'
import { DockerServicesConfig } from '@interfaces/configs/docker-services.interface'
import { createEnvFile } from '@utils/env-file'
import { jinja } from '@utils/jinja'

export default class Init extends Command {
  static description = 'This command initiates the container and creates the required variables.'

  public async shouldRunBefore (): Promise<void> {
    this.tasks.options = {
      rendererSilent: true
    }
  }

  public async run (): Promise<void> {
    this.tasks.add<InitCtx>([
      // set defaults for context
      {
        task: async (ctx): Promise<void> => {
          ctx.files = {
            config: join(this.cs.defaults, CONFIG_FILES.INIT),
            templates: join(this.cs.oclif.root, TEMPLATE_FOLDER)
          }

          this.logger.debug('Set defaults for context: %o', ctx, { context: 'context' })
        }
      },

      // loads the default configuration
      {
        task: async (ctx): Promise<void> => {
          this.logger.verbose('Loading default configuration.', { context: 'defaults' })

          ctx.config = await this.cs.read<DockerServicesConfig>(MergeStrategy.OVERWRITE, join(ctx.files.config, DEFAULT_CONFIG_FILE))

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { services: omit, ...rest } = ctx.config

          this.logger.debug('Configuration file defaults are loaded: %o', rest, { context: 'defaults' })
        }
      },

      // check if configuration loaded to the expected directory
      {
        skip: (): boolean => {
          if (this.fs.exists(normalize(MOUNTED_CONFIG_PATH))) {
            return false
          } else {
            this.logger.verbose('Mounted configuration file not found at "%s", skipping merge.', MOUNTED_CONFIG_PATH, { context: 'config' })

            return true
          }
        },
        task: async (ctx): Promise<void> => {
          ctx.config = merge(MergeStrategy.OVERWRITE, ctx.config, await this.cs.read(MergeStrategy.OVERWRITE, normalize(MOUNTED_CONFIG_PATH)))

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { services: omit, ...rest } = ctx.config

          this.logger.debug('Merged mounted configuration to defaults: %o', rest, { context: 'config' })

          this.logger.info('Extended defaults with configuration file found at "%s".', MOUNTED_CONFIG_PATH, { context: 'config' })
        }
      },

      // extend configuration with environment variables
      {
        task: (ctx): void => {
          const envVars = config.getCustomEnvVars<DockerServicesConfig>(ctx.files.config, [ YAML_FILE_EXT ])

          if (Object.keys(envVars).length > 0) {
            ctx.config = merge(MergeStrategy.OVERWRITE, ctx.config, envVars)

            this.logger.debug('Merged environment variables: %o', envVars, { context: 'environment' })

            this.logger.info('Extended defaults with environment variables.', { context: 'environment' })
          }
        }
      },

      // extend configuration with services environment variables
      {
        task: (ctx): void => {
          const servicesFromEnvVars = this.getEnvVariablesForService(ctx.config)

          if (Object.keys(servicesFromEnvVars).length > 0) {
            Object.entries(servicesFromEnvVars).forEach(([ i, value ]) => {
              ctx.config.services[i] = merge(MergeStrategy.OVERWRITE, ctx.config?.services?.[i], value)

              this.logger.debug('Merged environment for service %d: %o', i, ctx.config.services[i], { context: 'environment' })
            })

            this.logger.info('Extended %d services from environment variables.', Object.keys(servicesFromEnvVars).length, { context: 'environment' })
          } else {
            this.logger.verbose('No environment variables with "SERVICE_*" found to extend the services from, skipping merge.', { context: 'environment' })
          }
        }
      },

      {
        task: (ctx): void => {
          ctx.config.services = ctx.config.services.map((service) => {
            return merge(MergeStrategy.OVERWRITE, ctx.config.defaults, service) as DockerService
          })

          this.logger.debug('Merged default configuration to all services: %o', ctx.config.defaults, { context: 'defaults' })
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

          this.logger.debug('Services discovered: %o', ctx.config.services, { context: 'services' })
        }
      },

      // validate all variables
      {
        task: async (ctx): Promise<void> => {
          await this.validator.validate(DockerServicesConfig, ctx.config)
        }
      },

      // initiate fnm version
      {
        skip: (ctx): boolean => ctx.config.node_version === 'default',
        task: async (ctx): Promise<void> => {
          this.logger.info('Installing node version given from variables: %s', ctx.config.node_version, { context: 'node' })

          try {
            await pipeProcessToLogger(
              new Logger('fnm'),
              execa('fnm', [ 'install', ctx.config.node_version ], {
                shell: '/bin/bash',
                detached: false,
                extendEnv: false
              })
            )
          } catch (e) {
            this.logger.fatal('Can not use the given version with FNM.', { context: 'fnm' })

            this.logger.error('%o', e, { context: 'fnm' })

            this.exit(120)
          }
        }
      },

      // load fnm version from the root of the thingy
      {
        skip: (ctx): boolean =>
          ctx.config.node_version === 'default' && !this.fs.exists(join(MOUNTED_DATA_FOLDER, '.nvmrc')) && !this.fs.exists(join(MOUNTED_DATA_FOLDER, '.node-version')),
        task: async (): Promise<void> => {
          this.logger.info('Found node version override file in the root directory of the data folder.', { context: 'node' })

          try {
            await pipeProcessToLogger(
              new Logger('fnm'),
              execa('fnm', [ 'install' ], {
                shell: '/bin/bash',
                detached: false,
                extendEnv: false,
                cwd: MOUNTED_DATA_FOLDER
              })
            )
          } catch (e) {
            this.logger.fatal('Can not use the workspace version with FNM.', { context: 'fnm' })

            this.logger.error('%o', e, { context: 'fnm' })

            this.exit(120)
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
                const stat = this.fs.stats(dir)

                if (!stat.isDirectory()) {
                  errors.push(`Specified directory "${dir}" is not a directory for service ${i}.`)
                }
              } catch {
                errors.push(`Specified directory "${dir}" does not exists for service ${i}.`)
              }
            })
          )

          if (errors.length > 0) {
            errors.forEach((error) => this.logger.fatal(error, { context: 'services' }))

            this.exit(120)
          }
        }
      },

      // clean prior instance
      {
        task: async (): Promise<void> => {
          try {
            await Promise.all([ S6_FOLDERS.service, CONTAINER_ENV_FILE, CONTAINER_LOCK_FILE ].map((f) => this.fs.remove(f, { recursive: true })))
          } catch (e) {
            this.logger.debug(e.message)
          }

          try {
            await this.fs.mkdir(S6_FOLDERS.service)
          } catch (e) {
            this.logger.debug(e.message)
          }
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

          switch (this.cs.config.loglevel) {
          case LogLevels.DEBUG:
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

            this.logger.debug('Wrote lock file for preliminary services.', { context: 'preliminary-services' })
          }

          if (enabled.length < 1) {
            this.logger.fatal('No service is enabled at the moment. Please check the configuration.')

            this.exit(120)
          }

          await this.createRunScriptForService(ctx, enabled)
        }
      },

      // run install scripts if required
      {
        skip: (ctx): boolean => {
          if (ctx.config.dont_install) {
            this.logger.warn('dont_install is defined, will not install any dependencies in any case.')
          }

          return this.fs.exists(join(MOUNTED_DATA_FOLDER, 'node_modules')) && !ctx.config.force_install && !ctx.config.dont_install
        },
        task: async (ctx): Promise<void> => {
          if (ctx.config.force_install) {
            this.logger.info('force_install is defined, running dependency installation.', { context: 'dependencies' })
          } else {
            this.logger.info('node_modules is not found in the root of the mounted folder, running dependency installation.', { context: 'dependencies' })
          }

          let command: string

          if (ctx.config.package_manager === 'yarn') {
            command = 'yarn install'
          } else if (ctx.config.package_manager === 'npm') {
            command = 'npm install'
          } else {
            this.logger.fatal('Package manager value is not known: %s', ctx.config.package_manager, { context: 'dependencies' })
          }

          if (this.fs.exists(join(MOUNTED_DATA_FOLDER, '.nvmrc')) || this.fs.exists(join(MOUNTED_DATA_FOLDER, '.node-version'))) {
            this.logger.debug('Node version file is found. appending to command.')

            command = 'fnm use && ' + command
          }

          await pipeProcessToLogger(
            new Logger('fnm'),
            execa.command(`${command}`, {
              shell: '/bin/bash',
              detached: false,
              extendEnv: false,
              cwd: MOUNTED_DATA_FOLDER
            })
          )
        }
      },

      // run pre scripts
      {
        skip: (ctx): boolean => !ctx.config.before_all,
        task: async (ctx): Promise<void> => {
          this.logger.info('before_all is defined, running commands before starting services.', { context: 'before-all' })

          for (const command of ctx.config.before_all as string[]) {
            this.logger.info(`$ ${command}`, { context: 'before-all' })

            await pipeProcessToLogger(
              new Logger('before-all'),
              execa.command(command, {
                shell: '/bin/bash',
                detached: false,
                extendEnv: false,
                cwd: MOUNTED_DATA_FOLDER
              })
            )
          }
        }
      }
    ])
  }

  private async createRunScriptForService (ctx: InitCtx, services: DockerService[]): Promise<void> {
    const runTemplatePath = join(ctx.files.templates, TEMPLATES.run)
    const runTemplate = await this.fs.read(runTemplatePath)
    const finishTemplatePath = join(ctx.files.templates, TEMPLATES.finish)
    const finishTemplate = await this.fs.read(finishTemplatePath)

    await Promise.all(
      services.map(async (service) => {
        const runScriptTemplate = jinja(ctx.files.templates).renderString(runTemplate, { service, config: ctx.config })
        const finishScriptTemplate = jinja(ctx.files.templates).renderString(finishTemplate, { service, config: ctx.config })

        const serviceDir = join(S6_FOLDERS.service, service.id)
        const runScriptPath = join(serviceDir, S6_FOLDERS.runScriptName)
        const finishScriptPath = join(serviceDir, S6_FOLDERS.finishScriptName)

        await this.fs.mkdir(serviceDir)

        await Promise.all([ this.fs.write(runScriptPath, runScriptTemplate), this.fs.write(finishScriptPath, finishScriptTemplate) ])

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
        this.logger.fatal('Creating new services through environment variables has timed-out.', { context: 'environment' })

        throw new Error(`Timed-out in ${timeout}ms.`)
      }

      // check if variables required for a service exists
      const required = SERVICE_EXTENSION_ENVIRONMENT_VARIABLES.filter((variable) => variable.required)

      let shouldBreak: boolean

      required.forEach((variable) => {
        if (!process.env[`SERVICE_${i}_${variable.name}`] && !base.services?.[i]?.[variable.key]) {
          this.logger.verbose(`Required environment variable not found for service ${i}: "${variable.name}" with config key "${variable.key}"`, { context: 'environment' })

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
              this.logger.fatal(`Given variable "${name}" was supposed to be a valid stringified JSON.`, { context: 'environment' })

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
        this.logger.verbose(`Service ${i} extended with environment variables: %o`, service, { context: 'environment' })

        services[i] = service as DockerService
      }
    }

    return services
  }
}
