import { BaseCommand } from '@cenk1cenk2/boilerplate-oclif'
import { ExecaChildProcess, ExecaReturnValue } from 'execa'
import pidtree from 'pidtree'

import { Instance, NewProcessOptions, Tasks } from './process-manager.interface'

/**
 * Process manager is an instance where it tracks current child processes.abs
 *
 * You can add long-living and short-living process to keep track of processes spawned by node.
 */
export class ProcessManager {
  private tasks: Tasks = {}

  constructor (private readonly cmd: BaseCommand) {}

  /** Add a new task that is killable. */
  public add (key: string, instance: ExecaChildProcess, options?: NewProcessOptions): ExecaChildProcess {
    this.tasks[key] = [ ...this.tasks?.[key] ?? [], { instance, options } ]

    return instance
  }

  /** Kill all non-persistent tasks. */
  public async kill (key?: string): Promise<void | void[]> {
    await this.killProcesses((key ? this.tasks[key] : Object.values(this.tasks).flatMap((t) => t)).flatMap((t) => t.instance))

    this.flush(key)
  }

  /** Flush all tasks from a key. */
  public flush (key?: string): void {
    if (key) {
      delete this.tasks[key]
    } else {
      this.tasks = {}
    }
  }

  public fetchInstances (key?: string): Promise<ExecaReturnValue[]> {
    return Promise.all(this.fetchProcess(key).flatMap((p) => p.instance))
  }

  /** Fetches all active services. */
  public fetchProcess (key?: string): Instance[] {
    return Object.values(key ? this.tasks[key] : this.tasks)
  }

  /** Tree kill proceseses. */
  private async killProcesses (tasks: ExecaChildProcess[]): Promise<void | void[]> {
    if (tasks.length === 0) {
      this.cmd.logger.debug('Nothing found to kill.')
    } else {
      await Promise.all(
        tasks.map(async (instance) => {
          const instanceName = instance.spawnargs.join(' ')

          if (typeof instance.exitCode !== 'number') {
            let pids: number[]

            try {
              pids = await pidtree(instance.pid, { root: true })
            } catch (e) {
              this.cmd.logger.debug(`No matching PIDs has been found:\n${e}`)
            }

            await Promise.all(
              pids.map(async (pid) => {
                try {
                  process.kill(pid)
                  // eslint-disable-next-line no-empty
                } catch (err) {}
              })
            )

            this.cmd.logger.warn(`Killing instance: ${instanceName} (${pids.join(', ')})`)
          } else {
            this.cmd.logger.debug(`Instance is already stopped: ${instanceName}`)
          }
        })
      )
    }
  }
}
