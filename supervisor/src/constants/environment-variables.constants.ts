import { DockerService } from '@src/interfaces/configs/docker-services.interface'

export const SERVICE_EXTENSION_ENVIRONMENT_VARIABLES: {
  required?: boolean
  name: string
  parser?: 'json' | ((value: any, name: string) => any)
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
    parser: 'json'
  },
  {
    name: 'BEFORE',
    key: 'before',
    parser: 'json'
  },
  {
    name: 'LOGS',
    key: 'logs',
    parser: (value): boolean | string => {
      if (value === 'true' || value === 'false') {
        return JSON.parse(value)
      } else {
        return String(value)
      }
    }
  },
  {
    name: 'LOAD_DOTENV',
    key: 'load_dotenv',
    parser: 'json'
  },
  {
    name: 'COMMAND',
    key: 'command'
  },
  {
    name: 'SYNC',
    key: 'sync',
    parser: 'json'
  },
  {
    name: 'EXIT_ON_ERROR',
    key: 'exit_on_error',
    parser: (value): boolean | string => {
      if (value === 'true' || value === 'false') {
        return JSON.parse(value)
      } else {
        return String(value)
      }
    }
  },
  {
    name: 'ENVIRONMENT',
    key: 'environment',
    parser: 'json'
  }
]
