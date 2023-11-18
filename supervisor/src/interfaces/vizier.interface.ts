import type { VizierLogLevels } from '@constants'

export interface VizierPermission {
  user?: string
  group?: string
}

export interface VizierChmod {
  file?: string
  dir?: string
}

export interface VizierStepCommandRetry {
  retries?: number
  always?: boolean
  delay?: string
}

export interface VizierStepCommandLogLevel {
  stdout?: VizierLogLevels
  stderr?: VizierLogLevels
  lifetime?: VizierLogLevels
}

export interface VizierStepCommandRunAs extends VizierPermission {}

export interface VizierStepCommand {
  cwd?: string
  command: string
  retry?: VizierStepCommandRetry
  ignore_error?: boolean
  log?: VizierStepCommandLogLevel
  environment?: Record<string, string>
  run_as?: VizierStepCommandRunAs
}

export interface VizierStepPermission {
  path: string
  chown?: VizierPermission
  chmod?: VizierChmod
  recursive?: boolean
}

export interface VizierStep {
  name?: string
  commands?: VizierStepCommand[]
  permissions?: VizierStepPermission[]
  delay?: string
  background?: boolean
  parallel?: boolean
}

export type VizierConfig = VizierStep[]
