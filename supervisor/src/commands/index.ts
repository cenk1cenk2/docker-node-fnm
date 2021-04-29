import { BaseCommand, deepMergeWithArrayOverwrite, checkExists, readFile, yamlExtensions } from '@cenk1cenk2/boilerplate-oclif'
import config from 'config'
import fs from 'fs'
import { join, normalize } from 'node:path'
import { check } from 'prettier'

import { InitCtx } from '@interfaces/commands/init.interface'
import { SERVICE_EXTENSION_ENVIRONMENT_VARIABLES } from '@src/constants/environment-variables.constants'
import { MOUNTED_CONFIG_PATH } from '@src/constants/file-system.constants'
import { DockerService, DockerServicesConfig } from '@src/interfaces/configs/docker-services.interface'

export default class Init extends BaseCommand {
  static description = 'This command initiates the container and creates the required variables.'

  public async construct (): Promise<void> {
    this.tasks.options = {
      rendererSilent: true
    }
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

          this.logger.debug('Configuration file defaults are loaded: %o', ctx.config, { custom: 'defaults' })
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

          this.logger.debug('Merged mounted configuration to defaults: %o', ctx.config, { custom: 'config' })

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
      }

      // run services
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
