import { IsSemverOrDefault } from '@utils/validator'
import { IsBoolean, IsEnum, IsObject, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator'

export class DockerServicesConfig {
  @IsSemverOrDefault()
  node_version: 'default' | string

  @IsEnum([ 'yarn', 'npm' ])
  package_manager: 'yarn' | 'npm'

  @IsBoolean()
  force_install: boolean

  @IsPositive()
  sync_wait: number

  @IsBoolean()
  check_directories: boolean

  @ValidateNested()
  defaults: Pick<DockerService, 'enable' | 'logs' | 'load_dotenv' | 'before' | 'command' | 'sync' | 'environment'>

  @ValidateNested()
  services: DockerService[]
}

export class DockerService {
  @IsUUID()
  id: string

  @IsString()
  name: string

  @IsString()
  cwd: string

  @IsBoolean()
  enable?: boolean

  @IsEnum([ 'prefix', true, false ])
  logs?: 'prefix' | boolean

  @IsBoolean()
  load_dotenv?: boolean

  @IsString()
  before?: false | string[]

  @IsString()
  command?: string

  @IsString()
  parsed_command?: string

  @IsBoolean()
  sync?: boolean

  @IsObject()
  environment?: Record<string, string>
}
