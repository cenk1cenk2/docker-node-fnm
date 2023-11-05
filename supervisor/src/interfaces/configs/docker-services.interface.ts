import { Type } from 'class-transformer'
import { Allow, IsBoolean, IsEnum, IsObject, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator'

import { VizierLogger } from './vizier.interface.js'
import { IsFalseOrStringArray, IsSemverOrDefault } from '@utils'

export class DockerServiceDefaults {
  @IsUUID()
    id: string

  @IsBoolean()
    enable?: boolean

  // BUG: can not validate this properly
  @Allow()
  @Type(() => VizierLogger)
    log?: VizierLogger

  @IsBoolean()
    load_dotenv?: boolean

  @IsFalseOrStringArray()
    before?: false | string[]

  @IsString()
    command?: string

  @IsBoolean()
    sync?: boolean

  @IsBoolean()
    run_once?: boolean

  @IsBoolean()
    exit_on_error?: boolean

  @IsObject()
    environment?: Record<string, string>

  @IsSemverOrDefault()
    node_version?: 'default' | string

  @IsPositive()
    sync_wait?: number

  @IsPositive()
    restart_wait?: number
}

export class DockerService extends DockerServiceDefaults {
  @IsString()
    name?: string

  @IsString()
    cwd?: string
}

export class DockerServicesConfig {
  @IsEnum([ 'yarn', 'npm', 'pnpm' ])
    package_manager: 'yarn' | 'npm' | 'pnpm'

  @IsBoolean()
    dont_install: boolean

  @IsBoolean()
    force_install: boolean

  @IsFalseOrStringArray()
    before_all?: false | string[]

  @ValidateNested()
  @Type(() => DockerServiceDefaults)
    defaults: DockerServiceDefaults

  @ValidateNested({ each: true })
  @Type(() => DockerService)
    services: DockerService[]
}
