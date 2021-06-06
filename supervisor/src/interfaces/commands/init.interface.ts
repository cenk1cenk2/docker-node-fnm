import { ValidateNested } from 'class-validator'

import { DockerServicesConfig } from '@interfaces/configs/docker-services.interface'

export declare class InitCtx {
  @ValidateNested()
  config: DockerServicesConfig

  fileSystem: {
    config: string
    templates: string
  }
}
