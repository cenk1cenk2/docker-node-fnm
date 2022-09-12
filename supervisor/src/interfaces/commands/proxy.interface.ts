import { ValidateNested } from 'class-validator'

import type { ProxyConfig } from '../configs/proxy.interface'

export declare class ProxyCtx {
  root: string

  package: string

  files: {
    config: string
    env: string
  }

  @ValidateNested()
  config: ProxyConfig
}
