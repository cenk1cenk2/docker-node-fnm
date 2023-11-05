export interface VizierStepRetry {
  retries?: number
  always?: boolean
  delay?: string | number
}

export interface VizierStepLog {
  stdout?: number
  stderr?: number
  lifetime?: number
}

export interface VizierStep {
  name: string
  cwd?: string
  commands: string[]
  delay?: string | number
  retry?: VizierStepRetry
  environment?: Record<string, string>
  ignore_error?: boolean
  log?: VizierStepLog
}

export type VizierConfig = VizierStep[][]
