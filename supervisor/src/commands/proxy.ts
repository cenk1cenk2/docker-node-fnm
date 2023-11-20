import { execaCommand } from 'execa'
import { join } from 'path'

import type { DynamicModule, ShouldRunBeforeHook } from '@cenk1cenk2/oclif-common'
import { Command, ConfigService, EnvironmentVariableParser, JsonParser, ParserService, ValidatorModule, ValidatorService, YamlParser } from '@cenk1cenk2/oclif-common'
import { CONFIG_FILES, MOUNTED_DATA_FOLDER, TEMPLATE_FOLDER } from '@constants'
import type { ProxyCtx } from '@interfaces'
import { ProxyConfig } from '@interfaces'

export default class Proxy extends Command<typeof Proxy, ProxyCtx> implements ShouldRunBeforeHook {
  static description = 'This command initiates the proxies commands to the underlying container and pipes the data.'
  static strict = false

  private parser: ParserService
  private cs: ConfigService
  private validator: ValidatorService

  public async register (cli: DynamicModule): Promise<DynamicModule> {
    cli.imports.push(ValidatorModule)

    return cli
  }

  public async shouldRunBefore (): Promise<void> {
    this.parser = this.app.get(ParserService)
    this.cs = this.app.get(ConfigService)
    this.validator = this.app.get(ValidatorService)

    await this.parser.register(YamlParser, JsonParser, EnvironmentVariableParser)
    this.tasks.options = {
      silentRendererCondition: true
    }
  }

  public async run (): Promise<void> {
    this.tasks.add([
      {
        task: (): void => {
          if (this.argv.length < 1) {
            throw new Error('At least a command should be given to run in the workspace.')
          }
        }
      },

      // configure the application
      {
        task: async (ctx): Promise<void> => {
          ctx.root = MOUNTED_DATA_FOLDER
          ctx.files = {
            config: join(this.cs.defaults, CONFIG_FILES.PROXY),
            env: join(this.cs.defaults, CONFIG_FILES.PROXY_ENV),
            templates: join(this.cs.oclif.root, TEMPLATE_FOLDER)
          }
        }
      },

      {
        task: async (ctx): Promise<void> => {
          ctx.config = await this.cs.read<ProxyConfig>(ctx.files.config)

          this.logger.debug('Configuration file defaults are loaded: %o', ctx.config, { context: 'defaults' })

          ctx.config = await this.cs.env<ProxyConfig>(ctx.files.env, ctx.config)

          this.logger.debug('Configuration loaded: %o', ctx.config, { context: 'defaults' })

          ctx.config = await this.validator.validate(ProxyConfig, ctx.config)
        }
      },

      // run command
      {
        task: async (ctx): Promise<void> => {
          const commands: string[] = [ 'source /etc/bash.bashrc', 'fnm use --install-if-missing' ]

          if (ctx.config.before_all) {
            commands.push(...ctx.config.before_all)
          }

          const command = this.argv.join(' ')

          commands.push(command)

          this.logger.info('$ %s', command)
          this.logger.debug('Commands to run: %o', commands)

          await execaCommand(commands.join(' && '), {
            shell: '/bin/bash',
            stdio: 'inherit',
            cwd: ctx.root
          })
        }
      }
    ])
  }
}
