import { Transform } from 'class-transformer'
import { IsEnum } from 'class-validator'

import { VizierLogLevels } from '@constants'

export class VizierLogger {
  @IsEnum(VizierLogLevels)
  @Transform(({ value }) => {
    return typeof value === 'number' ? value : Object.values(VizierLogLevels).findIndex((level) => value === level)
  })
    stdout?: number

  @IsEnum(VizierLogLevels)
  @Transform(({ value }) => {
    return typeof value === 'number' ? value : Object.values(VizierLogLevels).findIndex((level) => value === level)
  })
    stderr?: number

  @IsEnum(VizierLogLevels)
  @Transform(({ value }) => {
    return typeof value === 'number' ? value : Object.values(VizierLogLevels).findIndex((level) => value === level)
  })
    lifetime?: number
}
