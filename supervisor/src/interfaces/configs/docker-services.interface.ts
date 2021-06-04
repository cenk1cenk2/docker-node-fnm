export interface DockerServicesConfig {
  node_version: 'default' | string
  package_manager: 'yarn' | 'npm'
  force_install: boolean
  sync_wait: number
  check_directories: boolean

  defaults: Pick<DockerService, 'enable' | 'logs' | 'load_dotenv' | 'before' | 'command' | 'sync' | 'environment'>

  services: DockerService[]
}

export interface DockerService {
  id: string
  name: string
  cwd: string
  enable?: boolean
  logs?: 'prefix' | boolean
  load_dotenv?: boolean
  before?: false | string[]
  command?: string
  parsed_command?: string
  sync?: boolean
  environment?: Record<string, string>
}
