import { ValidateNested } from 'class-validator'

import { ProxyConfig } from '../configs/proxy.interface'

export class ProxyCtx {
  root: string

  package: string

  files: {
    config: string
    env: string
  }

  @ValidateNested()
    config: ProxyConfig
}
