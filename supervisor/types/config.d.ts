import * as baseConfig from 'config'

declare module 'config' {
  interface IUtil {
    test: string
    getCustomEnvVars: <T extends Record<string, any>>(path: string, extensions: string[]) => Partial<T>
    parseFile: <T extends Record<string, any>>(path: string, options?: { skipConfigSources?: boolean }) => T
  }
}
