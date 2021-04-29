import { DockerService } from '@src/interfaces/configs/docker-services.interface'

export const SERVICE_EXTENSION_ENVIRONMENT_VARIABLES: { required?: boolean, name: string, parser?: 'json', type?: 'boolean' | 'object', key: keyof DockerService }[] = [
  {
    required: true,
    name: 'CWD',
    key: 'cwd'
  },
  {
    name: 'BEFORE',
    key: 'before',
    parser: 'json',
    type: 'object'
  },
  {
    name: 'LOGS',
    key: 'logs',
    parser: 'json',
    type: 'boolean'
  },
  {
    name: 'LOAD_DOTENV',
    key: 'load_dotenv',
    parser: 'json',
    type: 'boolean'
  },
  {
    name: 'COMMAND',
    key: 'command'
  },
  {
    name: 'SYNC',
    key: 'sync',
    parser: 'json',
    type: 'boolean'
  },
  {
    name: 'ENVIRONMENT',
    key: 'environment',
    parser: 'json',
    type: 'object'
  }
]
