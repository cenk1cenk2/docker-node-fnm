import { BaseCommand, checkExists, deepMergeWithArrayOverwrite, LogLevels, readFile, readRaw, writeFile } from '@cenk1cenk2/boilerplate-oclif'
import { pipeProcessToLogger } from '@utils/pipe-through-logger'
import config from 'config'
import execa from 'execa'
import fs from 'fs-extra'
import { join, normalize } from 'path'
import { v4 as uuid } from 'uuid'

import { InitCtx } from '@interfaces/commands/init.interface'
import { SERVICE_EXTENSION_ENVIRONMENT_VARIABLES } from '@src/constants/environment-variables.constants'
import { CONTAINER_ENV_FILE, CONTAINER_LOCK_FILE, MOUNTED_CONFIG_PATH, MOUNTED_DATA_FOLDER, S6_FOLDERS, TEMPLATES, TEMPLATE_FOLDER } from '@src/constants/file-system.constants'
import { DockerService, DockerServicesConfig } from '@src/interfaces/configs/docker-services.interface'
import { jinja } from '@src/utils/jinja'

export default class Init extends BaseCommand {
  static description = 'This command initiates the container and creates the required variables.'

  public async construct (): Promise<void> {
    this.tasks.options = {
      rendererSilent: true
    }

    // register exit listener
    process.on('SIGINT', async () => {
      this.logger.fatal('Caught terminate signal.', { context: 'exit' })
    })
  }

  public async run (): Promise<void> {
    this.tasks.add<InitCtx>([
      // set defaults for context
      {
        task: async (ctx): Promise<void> => {
          ctx.fileSystem = {
            config: join(this.config.root, 'config', 'defaults'),
            templates: join(this.config.root, TEMPLATE_FOLDER)
          }

          this.logger.debug('Set defaults for context: %o', ctx)
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

          this.logger.debug('Merged default configuration to all services: %o', ctx.config.defaults)
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

              // append the environment variables to command
              if (typeof service.environment === 'object' && Object.keys(service.environment).length > 0) {
                service.parsed_command = `${Object.entries(service.environment).reduce((o, [ envKey, envValue ]) => {
                  return `${envKey}=${envValue} ${o}`
                }, service.command)}`
              } else {
                service.parsed_command = service.command
              }

              // we wrap this inside "" so have to escape it all
              service.parsed_command = service.parsed_command.replaceAll('"', '\\"')
            })
          )

          this.logger.debug('Services discovered: %o', ctx.config.services, { custom: 'services' })
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

      // init variables for s6
      {
        task: async (ctx): Promise<void> => {
          switch (this.constants.loglevel) {
          case LogLevels.debug:
            await writeFile(CONTAINER_ENV_FILE, 'LOG_LEVEL="DEBUG"', true)
            break
          default:
            await writeFile(CONTAINER_ENV_FILE, 'LOG_LEVEL="INFO"', true)
          }

          const variables = [
            { name: 'PACKAGE_MANAGER', value: ctx.config.package_manager },
            { name: 'FORCE_INSTALL', value: ctx.config.force_install }
          ]

          for (const data of variables) {
            await writeFile(CONTAINER_ENV_FILE, `${data.name}=${data.value}`, true)
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
            await fs.writeFile(CONTAINER_LOCK_FILE, `PRELIMINARY_SERVICES=( ${preliminary.map((s) => s.id).join(' ')} )`)

            this.logger.debug('Wrote lock file for preliminary services.', { custom: 'sync-services' })
          }

          if (enabled.length < 1) {
            this.logger.fatal('No service is enabled at the moment.')

            process.exit(120)
          }

          await this.createRunScriptForService(ctx, enabled)
        }
      }
    ])
  }

  private async createRunScriptForService (ctx: InitCtx, services: DockerService[]): Promise<void> {
    const templatePath = join(ctx.fileSystem.templates, TEMPLATES.run)
    const template = await readRaw(templatePath)

    await Promise.all(
      services.map(async (service) => {
        const s6ServiceRunTemplate = jinja(ctx.fileSystem.templates).renderString(template, { service, config: ctx.config })
        const s6ServiceDir = join(S6_FOLDERS.service, service.id)
        const s6ServiceRunScriptPath = join(s6ServiceDir, S6_FOLDERS.runScriptName)

        await fs.mkdirp(s6ServiceDir)

        await writeFile(s6ServiceRunScriptPath, s6ServiceRunTemplate)

        await fs.chmod(s6ServiceRunScriptPath, '0764')

        this.logger.debug('Initiated service run script for directory "%s": %s', service.cwd, s6ServiceRunScriptPath, { context: 'services' })
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
          } else {
            service[variable.key] = String(env)
          }

          // typechecks for environment variables
          if (variable.validate) {
            variable.validate.bind(this)(services[variable.key], name)
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
