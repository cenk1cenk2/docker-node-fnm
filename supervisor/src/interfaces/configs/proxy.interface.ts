import { IsFalseOrStringArray } from '@utils'

export class ProxyConfig {
  @IsFalseOrStringArray()
    before_all?: false | string[]
}
