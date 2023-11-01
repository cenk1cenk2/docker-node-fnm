import { ValidateNested } from 'class-validator'

import { DockerServicesConfig } from '../configs/docker-services.interface.js'

export class InitCtx {
  files: {
    config: string
    env: string
    templates: string
  }

  @ValidateNested()
    config: DockerServicesConfig
}
