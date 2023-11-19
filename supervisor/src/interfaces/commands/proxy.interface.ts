import { ValidateNested } from 'class-validator'

import { ProxyConfig } from '../configs/proxy.interface.js'

export class ProxyCtx {
  root: string

  files: {
    config: string
    env: string
    templates: string
  }

  @ValidateNested()
    config: ProxyConfig
}
