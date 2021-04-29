import { DockerServicesConfig } from '@interfaces/configs/docker-services.interface'

export interface InitCtx {
  config: DockerServicesConfig
  configurationDirectory: string
}
