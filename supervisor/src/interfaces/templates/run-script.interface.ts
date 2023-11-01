import type { DockerService, DockerServicesConfig } from '../configs/docker-services.interface.js'

export interface RunScriptTemplate {
  config: DockerServicesConfig
  service: DockerService
}
