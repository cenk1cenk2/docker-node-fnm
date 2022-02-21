import type { ExecaChildProcess } from 'execa'
import through from 'through'

import type { PipeProcessToLoggerOptions } from './pipe-through-logger.interface'
import type { BaseCommand } from '@cenk1cenk2/boilerplate-oclif'

export function pipeProcessToLogger (this: BaseCommand, { instance, options }: { instance: ExecaChildProcess, options?: PipeProcessToLoggerOptions }): ExecaChildProcess {
  // default options
  options = {
    exitCode: false,
    start: false,
    stderr: true,
    stdout: true,
    meta: [],
    ...options
  }

  if (options.start) {
    this.logger.info(`Spawning process: ${instance.spawnargs.join(' ')}`, ...options.meta)
  }

  if (instance.stdout) {
    instance.stdout.pipe(
      through((chunk: Buffer) => {
        if (options.stdout) {
          this.logger.info(chunk.toString(), ...options.meta)
        } else {
          this.logger.debug(chunk.toString(), ...options.meta)
        }
      })
    )
  }

  if (instance.stderr) {
    instance.stderr.pipe(
      through((chunk: Buffer) => {
        if (options.stderr) {
          this.logger.warn(chunk.toString(), ...options.meta)
        } else {
          this.logger.debug(chunk.toString(), ...options.meta)
        }
      })
    )
  }

  if (options.exitCode) {
    void instance.on('exit', (code, signal) => {
      const exitMessage = `Process ended with code ${code}${signal ? ` and signal ${signal}` : ''}.`

      if (code > 0) {
        this.logger.error(exitMessage, ...options.meta)
      } else {
        this.logger.info(exitMessage, ...options.meta)
      }

      // callback for compatibility reasons with observable
      if (options?.callback) {
        options.callback()
      }
    })
  }

  void instance.on('error', (error) => {
    this.logger.error(error.message, ...options.meta)

    // callback for compatibility reasons with observable
    if (options?.callback) {
      options.callback(error)
    }
  })

  return instance
}
