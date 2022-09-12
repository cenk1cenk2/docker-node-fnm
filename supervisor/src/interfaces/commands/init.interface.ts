import { ValidateNested } from 'class-validator'

import type { DockerServicesConfig } from '@interfaces/configs/docker-services.interface'

export declare class InitCtx {
  files: {
    config: string
    env: string
    templates: string
  }

  @ValidateNested()
  config: DockerServicesConfig
}
