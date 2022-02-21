import type { DockerService, DockerServicesConfig } from '../configs/docker-services.interface'

export interface RunScriptTemplate {
  config: DockerServicesConfig
  service: DockerService
}
