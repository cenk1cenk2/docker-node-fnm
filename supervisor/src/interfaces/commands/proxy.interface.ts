import { ValidateNested } from 'class-validator'

import type { ProxyConfig } from '../configs/proxy.interface'

export declare class ProxyCtx {
  root: string

  package: string

  fileSystem: {
    config: string
  }

  @ValidateNested()
    config: ProxyConfig
}
