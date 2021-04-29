export interface DockerServicesConfig {
  node_version: 'default' | string
  use_fnm: boolean
  package_manager: 'yarn' | 'npm'
  force_install: boolean
  sync_wait: number

  defaults: {
    enable: boolean
    logs: boolean | 'prefix'
    load_dotenv: boolean
    before: boolean | string[]
    command: string
  }

  services: DockerService[]
}

export interface DockerService {
  cwd: string
  enable?: boolean
  logs?: 'prefix'
  load_dotenv?: boolean
  before?: boolean | string[]
  command?: string
  sync?: boolean
  environment?: Record<string, string>
}
