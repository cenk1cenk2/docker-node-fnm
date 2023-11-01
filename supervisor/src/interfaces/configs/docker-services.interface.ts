import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsEnum, IsNotEmpty, IsObject, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator'

import { IsFalseOrStringArray, IsSemverOrDefault } from '@utils'

export class DockerServicesConfig {
  @IsSemverOrDefault()
    node_version: 'default' | string

  @IsEnum([ 'yarn', 'npm', 'pnpm' ])
    package_manager: 'yarn' | 'npm' | 'pnpm'

  @IsBoolean()
    dont_install: boolean

  @IsBoolean()
    force_install: boolean

  @IsPositive()
    sync_wait: number

  @IsPositive()
    restart_wait: number

  @IsEnum([ true, false, 'true', 'false' ])
    check_directories: boolean

  @IsFalseOrStringArray()
    before_all?: false | string[]

  @ValidateNested()
  @Type(() => DockerService)
    defaults: Pick<DockerService, 'enable' | 'logs' | 'load_dotenv' | 'before' | 'command' | 'sync' | 'run_once' | 'exit_on_error' | 'environment'>

  @ValidateNested({ each: true })
  @Type(() => DockerService)
    services: DockerService[]
}

export class DockerService {
  @IsUUID()
    id: string

  @IsString()
    name: string

  @IsString()
  @IsNotEmpty()
    cwd: string

  @IsBoolean()
    enable?: boolean

  @IsEnum([ 'prefix', true, false, 'true', 'false' ])
  @Transform((params) => {
    if (params.value === 'true' || params.value === 'false') {
      return JSON.parse(params.value)
    }

    return params.value
  })
    logs?: 'prefix' | boolean

  @IsSemverOrDefault()
    node_version: 'default' | string

  @IsBoolean()
    load_dotenv?: boolean

  @IsFalseOrStringArray()
    before?: false | string[]

  @IsString()
    command?: string

  @IsString()
    parsed_command?: string

  @IsBoolean()
    sync?: boolean

  @IsBoolean()
    run_once?: boolean

  @IsBoolean()
    exit_on_error?: boolean

  @IsObject()
    environment?: Record<string, string>

  @IsString()
    parsed_environment?: string
}
