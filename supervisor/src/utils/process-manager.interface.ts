import { ExecaChildProcess } from 'execa'

export interface NewProcessOptions {
  retry: boolean | number
}

export type Tasks = Record<string, Instance[]>

export type Instance = { instance: ExecaChildProcess, options?: NewProcessOptions }
