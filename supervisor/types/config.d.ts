/* eslint-disable @typescript-eslint/no-unused-vars */
import * as baseConfig from 'config'

declare module 'config' {
  interface IUtil {
    getCustomEnvVars: <T extends Record<string, any>>(path: string, extensions: string[]) => Partial<T>
    parseFile: <T extends Record<string, any>>(path: string, options?: { skipConfigSources?: boolean }) => T
  }
}
