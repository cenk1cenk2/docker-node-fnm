import { ValidateNested } from 'class-validator'

import { ProxyConfig } from '../configs/proxy.interface'

export declare class ProxyCtx {
  @ValidateNested()
    config: ProxyConfig

  root: string

  package: string

  fileSystem: {
    config: string
  }
}
