import type { VizierLogLevels } from '@constants'

export interface VizierChown {
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

export interface VizierStepCommandRunAs extends VizierChown {}

export interface VizierStepHealth {
  ignoreError?: boolean
  ensureIsAlive?: boolean
}

export interface VizierStepCommand {
  cwd?: string
  command: string
  retry?: VizierStepCommandRetry
  log?: VizierStepCommandLogLevel
  environment?: Record<string, string>
  runAs?: VizierStepCommandRunAs
  health?: VizierStepHealth
}

export interface VizierStepPermission {
  path: string
  chown?: VizierChown
  chmod?: VizierChmod
  recursive?: boolean
}

export interface VizierStepTemplate {
  input: string
  output: string
  ctx?: any
  chmod?: VizierChmod
  chown?: VizierChown
}

export interface VizierStep {
  name?: string
  commands?: VizierStepCommand[]
  permissions?: VizierStepPermission[]
  templates?: VizierStepTemplate[]
  delay?: string
  background?: boolean
  parallel?: boolean
}

export type VizierConfig = VizierStep[]
