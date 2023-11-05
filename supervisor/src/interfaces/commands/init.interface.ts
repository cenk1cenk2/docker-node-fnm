import { ValidateNested } from 'class-validator'

import { DockerServicesConfig } from '../configs/docker-services.interface.js'
import type { VizierConfig } from '@interfaces'

export class InitCtx {
  files: {
    config: string
    env: string
    templates: string
  }

  vizier: VizierConfig

  @ValidateNested()
    config: DockerServicesConfig
}
