import { ValidateNested } from 'class-validator'

import { DockerServicesConfig } from '@interfaces'

export class InitCtx {
  files: {
    config: string
    env: string
    templates: string
  }

  @ValidateNested()
    config: DockerServicesConfig
}
