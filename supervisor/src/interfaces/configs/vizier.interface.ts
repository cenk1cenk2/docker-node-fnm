import { IsEnum } from 'class-validator'

import { VizierLogLevels } from '@constants'

export class VizierLogger {
  @IsEnum(VizierLogLevels)
    stdout?: VizierLogLevels

  @IsEnum(VizierLogLevels)
    stderr?: VizierLogLevels

  @IsEnum(VizierLogLevels)
    lifetime?: VizierLogLevels
}
