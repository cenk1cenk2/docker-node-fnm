import { IsBoolean, IsString } from 'class-validator'

export class ProxyConfig {
  @IsBoolean()
  workspace_only: boolean

  @IsString()
  packages_folder: string

  @IsBoolean()
  load_dotenv: boolean
}
