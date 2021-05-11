import { BaseCommand, checkExists, deepMergeWithArrayOverwrite, readFile } from '@cenk1cenk2/boilerplate-oclif'
import { pipeProcessToLogger } from '@utils/pipe-through-logger'
import config from 'config'
import delay from 'delay'
import execa from 'execa'
import fs from 'fs'
import pmap from 'p-map'
import { join, normalize } from 'path'
import { v4 as uuid } from 'uuid'

import { InitCtx } from '@interfaces/commands/init.interface'
import { SERVICE_EXTENSION_ENVIRONMENT_VARIABLES } from '@src/constants/environment-variables.constants'
import { MOUNTED_CONFIG_PATH, MOUNTED_DATA_FOLDER } from '@src/constants/file-system.constants'
import { DockerService, DockerServicesConfig } from '@src/interfaces/configs/docker-services.interface'
import { ProcessManager } from '@src/utils/process-manager'

export default class Init extends BaseCommand {
  static description = 'This command initiates the container and creates the required variables.'
  private process = new ProcessManager(this)

  public async construct (): Promise<void> {
    this.tasks.options = {
      rendererSilent: true
    }

    // register exit listener
    process.on('SIGINT', async () => {
      this.logger.fatal('Caught terminate signal.', { context: 'exit' })

      // this is not guaranteed, best effort is enough
      await this.process.kill().finally(() => process.exit(127))
    })
  }

  public async run (): Promise<void> {
    this.tasks.add<InitCtx>([
      // set configuration directory
      {
        task: async (ctx): Promise<void> => {
          ctx.configurationDirectory = join(this.config.root, 'config', 'defaults')

          this.logger.debug('Set defaults for context: %o', ctx)
        }
      },

      // loads the default configuration
      {
        task: async (ctx): Promise<void> => {
          this.logger.verbose('Loading default configuration.', { custom: 'defaults' })

          ctx.config = config.util.parseFile(join(ctx.configurationDirectory, 'default.yml'))

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
          const envVars = config.util.getCustomEnvVars<DockerServicesConfig>(ctx.configurationDirectory, [ 'yml' ])

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
              ctx.config.services[i] = deepMergeWithArrayOverwrite(ctx.config.defaults, ctx.config?.services?.[i], value)

              this.logger.debug(`Merged environment for service ${i}: %o`, ctx.config.services[i], { custom: 'environment' })
            })

            this.logger.module('Extended %i services from environment variables.', Object.keys(servicesFromEnvVars).length, { custom: 'environment' })
          } else {
            this.logger.warn('No environment variables with "SERVICE_*" found to extend the services from, skipping merge.', { custom: 'environment' })
          }
        }
      },

      // normalize variables
      {
        task: async (ctx): Promise<void> => {
          // sync wait to seconds
          ctx.config.sync_wait = ctx.config.sync_wait * 1000

          // service names
          await Promise.all(
            ctx.config.services.map(async (service) => {
              service.id = uuid()
            })
          )

          this.logger.debug('Services discovered: %o', ctx.config.services, { custom: 'services' })
        }
      },

      // initiate fnm version
      {
        task: async (ctx): Promise<void> => {
          if (ctx.config.node_version !== 'default') {
            this.logger.module('Installing node version given from variables: %s', ctx.config.node_version, { custom: 'node' })

            await pipeProcessToLogger.bind(this)({
              instance: execa('fnm', [ 'install', ctx.config.node_version ], {
                shell: '/bin/bash',
                detached: false,
                extendEnv: false
              }),
              options: { meta: [ { custom: 'fnm', trimEmptyLines: true } ] }
            })
          }
        }
      },

      // load fnm version from the root of the thingy
      {
        skip: (): boolean => !checkExists(join(MOUNTED_DATA_FOLDER, '.nvmrc')) && !checkExists(join(MOUNTED_DATA_FOLDER, '.node-version')),
        task: async (): Promise<void> => {
          this.logger.module('Found overwrite file in the root directory of the data folder.', { custom: 'fnm' })

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
          } catch {
            this.logger.fatal('Can not use the workspace version with FNM.', { custom: 'fnm' })

            process.exit(120)
          }
        }
      },

      // check all the given cwds exists
      {
        skip: true,
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

      // run preliminary services
      {
        task: async (ctx): Promise<void> => {
          const preliminary = ctx.config.services.filter((service) => service.sync === true && service.enable === true)

          this.logger.debug('Synchronous services: %o', preliminary, { custom: 'sync-services' })

          await pmap(
            preliminary,
            async (service) => {
              if (Array.isArray(service.before)) {
                this.logger.debug('Running before commands of synchronous service: %s', service.cwd, { context: 'sync-services' })

                try {
                  await pmap(
                    service.before,
                    (command) => {
                      return this.process.add(
                        service.id,
                        pipeProcessToLogger.bind(this)({
                          instance: execa.command(command, {
                            shell: '/bin/bash',
                            detached: false,
                            extendEnv: false,
                            stdin: 'ignore',
                            cwd: join(MOUNTED_DATA_FOLDER, service.cwd)
                          }),
                          options: {
                            start: true,
                            exitCode: true,
                            meta: [ { custom: service.cwd } ]
                          }
                        })
                      )
                    },
                    { concurrency: 1 }
                  )
                } catch {
                  this.logger.fatal('Encountered an error while executing before commands of service: "%s"', service.cwd)
                } finally {
                  this.process.flush(service.id)
                }
              }

              const wait = delay(ctx.config.sync_wait)

              this.logger.debug('Running synchronous service: %s', service.cwd, { context: 'sync-services' })

              this.process.add(
                service.id,
                pipeProcessToLogger.bind(this)({
                  instance: execa.command(service.command, {
                    shell: '/bin/bash',
                    detached: false,
                    extendEnv: false,
                    env: service.environment,
                    stdin: 'ignore',
                    cwd: join(MOUNTED_DATA_FOLDER, service.cwd)
                  }),
                  options: {
                    start: true,
                    exitCode: true,
                    meta: [ { custom: service.cwd } ]
                  }
                }),
                { retry: true }
              )

              this.logger.warn('Waiting for %i seconds for starting another service...', ctx.config.sync_wait / 1000, { custom: 'supervisor' })

              await wait
            },
            { concurrency: 1 }
          )
        }
      },

      // wait for all active services
      {
        task: async (): Promise<void> => {
          this.logger.debug('All services are initiated, now waiting for them.', { context: 'supervisor' })

          await this.process.fetchInstances()
        }
      }
    ])
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
          if (variable.type && typeof service[variable.key] !== variable.type) {
            this.logger.fatal(`Given variable "${name}" was supposed to be a "${variable.type}" while it is "${typeof services[variable.key]}".`, { custom: 'environment' })

            process.exit(127)
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
