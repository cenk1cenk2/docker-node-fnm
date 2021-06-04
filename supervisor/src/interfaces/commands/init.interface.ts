import { DockerServicesConfig } from '@interfaces/configs/docker-services.interface'

export interface InitCtx {
  config: DockerServicesConfig
  fileSystem: {
    config: string
    templates: string
  }
}
