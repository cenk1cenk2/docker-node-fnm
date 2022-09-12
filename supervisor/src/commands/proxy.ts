import dotenv from 'dotenv'
import execa from 'execa'
import { dirname, join } from 'path'

import { Command, fs } from '@cenk1cenk2/oclif-common'
import { CONFIG_FILES, MOUNTED_DATA_FOLDER } from '@constants/file-system.constants'
import { PACKAGE_ROOT_DEFINITIONS } from '@constants/keywords.constants'
import type { ProxyCtx } from '@interfaces/commands/proxy.interface'
import type { ProxyConfig } from '@interfaces/configs/proxy.interface'

export default class Proxy extends Command<ProxyCtx> {
  static description = 'This command initiates the proxies commands to the underlying container and pipes the data.'

  public async shouldRunBefore (): Promise<void> {
    this.tasks.options = {
      rendererSilent: true
    }
  }

  public async run (): Promise<void> {
    this.tasks.add([
      // set defaults for context
      {
        task: async (ctx): Promise<void> => {
          ctx.files = {
            config: join(this.cs.defaults, CONFIG_FILES.PROXY),
            env: join(this.cs.defaults, CONFIG_FILES.PROXY_ENV)
          }

          this.logger.debug('Set defaults for context: %o', ctx, { context: 'defaults' })
        }
      },

      // loads the default configuration
      {
        task: async (ctx): Promise<void> => {
          this.logger.verbose('Loading configuration.', { context: 'config' })

          ctx.config = await this.cs.read<ProxyConfig>(ctx.files.config)

          this.logger.debug('Configuration file defaults is loaded: %o', ctx.config, { context: 'defaults' })
        }
      },

      // extend configuration with environment variables
      {
        task: async (ctx): Promise<void> => {
          ctx.config = await this.cs.env(ctx.files.env, ctx.config)
        }
      },

      // configure the application
      {
        task: (ctx): void => {
          if (ctx.config.workspace_only) {
            if (this.argv.length < 1) {
              this.logger.fatal('At least a command should be given to run in the workspace.')

              this.exit(115)
            }

            ctx.root = MOUNTED_DATA_FOLDER
          } else {
            if (this.argv.length < 2) {
              this.logger.fatal('Root directory should be given as the first argument and the command as the rest.')

              this.exit(115)
            }

            ctx.package = this.argv.shift()

            if (PACKAGE_ROOT_DEFINITIONS.includes(ctx.package)) {
              ctx.root = MOUNTED_DATA_FOLDER

              this.logger.warn('Running in package root.')
            } else {
              ctx.root = join(MOUNTED_DATA_FOLDER, ctx.config.packages_folder, ctx.package)
            }
          }
        }
      },

      // check if root directory exists
      {
        task: (ctx): void => {
          let stat: fs.Stats

          try {
            /* eslint-disable-next-line prefer-const */
            stat = this.fs.stats(ctx.root)
          } finally {
            if (!stat || !stat.isDirectory()) {
              this.logger.fatal(`Specified root "${ctx.root}" is not a directory.`)

              const directories = fs
                .readdirSync(dirname(ctx.root), { withFileTypes: true })
                .filter((dir) => dir.isDirectory())
                .map((dir) => dir.name)
                .join(', ')

              this.logger.fatal(`Available directories are: ${directories}`)

              this.exit(110)
            }
          }
        }
      },

      // run command
      {
        task: async (ctx): Promise<void> => {
          let command = this.argv.join(' ')

          this.logger.info('%s : $ %s', ctx.root, command, { context: 'run' })

          let environment: Record<string, any> = {}
          const envPath = join(ctx.root, '.env')

          if (ctx.config.load_dotenv && fs.existsSync(envPath)) {
            try {
              environment = dotenv.parse(fs.readFileSync(envPath))

              this.logger.info('Environment file imported.', { context: 'environment' })
            } catch {
              this.logger.fatal('Error while parsing environment file: %s', envPath)
            }
          }

          this.logger.debug('%o', { FORCE_COLOR: 1, environment }, { context: 'environment' })

          command = this.cs.isVerbose ? command + ' ' + '--verbose' : command
          command = this.cs.isDebug ? command + ' ' + '--debug' : command

          try {
            await execa.command(`source /etc/bash.bashrc && fnm use --install-if-missing && cd ${ctx.root} && ${command}`, {
              shell: '/bin/bash',
              stdio: 'inherit',
              env: environment,
              extendEnv: false
            })
          } catch (e) {
            this.logger.fatal(command)

            this.logger.debug(e)

            this.exit(127)
          }
        }
      }
    ])
  }
}
