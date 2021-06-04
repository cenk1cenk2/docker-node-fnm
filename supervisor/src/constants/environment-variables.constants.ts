import { DockerService } from '@src/interfaces/configs/docker-services.interface'

export const SERVICE_EXTENSION_ENVIRONMENT_VARIABLES: {
  required?: boolean
  name: string
  parser?: 'json'
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
    parser: 'json'
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
    name: 'ENVIRONMENT',
    key: 'environment',
    parser: 'json'
  }
]
