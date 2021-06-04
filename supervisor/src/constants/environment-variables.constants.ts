import { BaseCommand } from '@cenk1cenk2/boilerplate-oclif'

import { DockerService } from '@src/interfaces/configs/docker-services.interface'

export const SERVICE_EXTENSION_ENVIRONMENT_VARIABLES: {
  required?: boolean
  name: string
  parser?: 'json'
  validate?: (this: BaseCommand, variable: unknown, name: string) => never | void
  key: keyof DockerService
}[] = [
  {
    required: true,
    name: 'CWD',
    key: 'cwd'
  },
  {
    name: 'NAME',
    key: 'name'
  },
  {
    name: 'ENABLE',
    key: 'enable',
    parser: 'json',
    validate (variable, name): void {
      if (typeof variable !== 'boolean') {
        this.logger.fatal(`Variable ${name} should be an boolean. Type is %s.`, typeof variable)

        process.exit(120)
      }
    }
  },
  {
    name: 'BEFORE',
    key: 'before',
    parser: 'json',
    validate (variable, name): void {
      if (!Array.isArray(variable)) {
        this.logger.fatal(`Variable ${name} should be an object.`)

        process.exit(120)
      }
    }
  },
  {
    name: 'LOGS',
    key: 'logs',
    parser: 'json',
    validate (variable, name): void {
      if (typeof variable !== 'boolean' || typeof variable === 'string' && ![ 'prefix' ].includes(variable)) {
        this.logger.fatal(`Variable ${name} should be a boolean or string 'prefix'.`)

        process.exit(120)
      }
    }
  },
  {
    name: 'LOAD_DOTENV',
    key: 'load_dotenv',
    parser: 'json',
    validate (variable, name): void {
      if (typeof variable !== 'boolean') {
        this.logger.fatal(`Variable ${name} should be a boolean.`)

        process.exit(120)
      }
    }
  },
  {
    name: 'COMMAND',
    key: 'command'
  },
  {
    name: 'SYNC',
    key: 'sync',
    parser: 'json',
    validate (variable, name): void {
      if (typeof variable !== 'boolean') {
        this.logger.fatal(`Variable ${name} should be a boolean.`)

        process.exit(120)
      }
    }
  },
  {
    name: 'ENVIRONMENT',
    key: 'environment',
    parser: 'json',
    validate (variable, name): void {
      if (typeof variable !== 'object') {
        this.logger.fatal(`Variable ${name} should be an object.`)

        process.exit(120)
      }
    }
  }
]
