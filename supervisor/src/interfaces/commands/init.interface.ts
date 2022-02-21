import { ValidateNested } from 'class-validator'

import type { DockerServicesConfig } from '@interfaces/configs/docker-services.interface'

export declare class InitCtx {
  fileSystem: {
    config: string
    templates: string
  }

  @ValidateNested()
    config: DockerServicesConfig
}
