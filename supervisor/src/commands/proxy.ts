import { BaseCommand, deepMergeWithArrayOverwrite } from '@cenk1cenk2/boilerplate-oclif'
import { CONFIG_FILES, MOUNTED_DATA_FOLDER } from '@constants/file-system.constants'
import config from 'config'
import dotenv from 'dotenv'
import execa from 'execa'
import { Stats } from 'fs'
import fs from 'fs-extra'
import { dirname, join } from 'path'

import { ProxyCtx } from '@interfaces/commands/proxy.interface'
import { ProxyConfig } from '@interfaces/configs/proxy.interface'
import { PACKAGE_ROOT_DEFINITIONS } from '@src/constants/keywords.constants'
import 'reflect-metadata'

export default class Init extends BaseCommand {
  static description = 'This command initiates the proxies commands to the underlying container and pipes the data.'

  public async construct (): Promise<void> {
    this.tasks.options = {
      rendererSilent: true
    }
  }

  public async run (): Promise<void> {
    this.tasks.add<ProxyCtx>([
      // set defaults for context
      {
        task: async (ctx): Promise<void> => {
          ctx.fileSystem = {
            config: join(this.config.root, 'config', CONFIG_FILES.proxy)
          }

          this.logger.debug('Set defaults for context: %o', ctx, { context: 'defaults' })
        }
      },

      // loads the default configuration
      {
        task: async (ctx): Promise<void> => {
          this.logger.verbose('Loading configuration.', { custom: 'config' })

          ctx.config = config.util.parseFile(join(ctx.fileSystem.config, 'default.yml'))

          this.logger.debug('Configuration file defaults is loaded: %o', ctx.config, { custom: 'defaults' })
        }
      },

      // extend configuration with environment variables
      {
        task: (ctx): void => {
          const envVars = config.util.getCustomEnvVars<ProxyConfig>(ctx.fileSystem.config, [ 'yml' ])

          if (Object.keys(envVars).length > 0) {
            ctx.config = deepMergeWithArrayOverwrite(ctx.config, envVars)

            this.logger.debug('Merged environment variables: %o', envVars, { custom: 'environment' })
          }
        }
      },

      // configure the application
      {
        task: (ctx): void => {
          if (ctx.config.workspace_only) {
            if (this.argv.length < 1) {
              this.logger.fatal('At least a command should be given to run in the workspace.')

              process.exit(115)
            }

            ctx.root = MOUNTED_DATA_FOLDER
          } else {
            if (this.argv.length < 2) {
              this.logger.fatal('Root directory should be given as the first argument and the command as the rest.')

              process.exit(115)
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
          let stat: Stats
          try {
            stat = fs.statSync(ctx.root)
          } finally {
            if (!stat || !stat.isDirectory()) {
              this.logger.fatal(`Specified root "${ctx.root}" is not a directory.`)

              const directories = fs
                .readdirSync(dirname(ctx.root), { withFileTypes: true })
                .filter((dir) => dir.isDirectory())
                .map((dir) => dir.name)
                .join(', ')

              this.logger.fatal(`Available directories are: ${directories}`)

              process.exit(110)
            }
          }
        }
      },

      // run command
      {
        task: async (ctx): Promise<void> => {
          const command = this.argv.join(' ')
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

          this.logger.debug('%o', environment, { context: 'environment' })

          try {
            await execa.command(`source /root/.bashrc && fnm use --install-if-missing && cd ${ctx.root} && ${command}`, {
              shell: '/bin/bash',
              stdio: 'inherit',
              env: environment,
              extendEnv: false
            })
          } catch (e) {
            this.logger.fatal(command)

            this.logger.debug(e)

            process.exit(127)
          }
        }
      }
    ])
  }
}
