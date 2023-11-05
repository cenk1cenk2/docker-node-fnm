import { randomUUID } from 'crypto'
import { join, normalize } from 'path'

import type { DynamicModule, RegisterHook, ShouldRunAfterHook, ShouldRunBeforeHook } from '@cenk1cenk2/oclif-common'
import {
  Command,
  ConfigService,
  EnvironmentVariableParser,
  FileSystemService,
  JsonParser,
  LockerModule,
  LockerService,
  MergeStrategy,
  ParserService,
  ValidatorModule,
  ValidatorService,
  YamlParser
} from '@cenk1cenk2/oclif-common'
import { CONFIG_FILES, MOUNTED_CONFIG_PATH, MOUNTED_DATA_FOLDER, TEMPLATE_FOLDER, TEMPLATE_RUN, VIZIER_CONFIG_FILE, VIZIER_FOLDER } from '@constants'
import type { DockerService, InitCtx, VizierConfig, VizierStep } from '@interfaces'
import { DockerServicesConfig } from '@interfaces'
import type { Jinja } from '@utils'
import { jinja } from '@utils'

export default class Init extends Command<typeof Init, InitCtx> implements ShouldRunBeforeHook, ShouldRunAfterHook<InitCtx>, RegisterHook {
  static description = 'This command initiates the container and creates the required variables.'

  private cs: ConfigService
  private fs: FileSystemService
  private validator: ValidatorService
  private parser: ParserService
  private locker: LockerService<VizierConfig>
  private jinja: Jinja

  public async register (cli: DynamicModule): Promise<DynamicModule> {
    cli.imports.push(ValidatorModule)
    cli.imports.push(LockerModule.forFeature({ file: VIZIER_CONFIG_FILE, parser: JsonParser }))

    return cli
  }

  public async shouldRunBefore (): Promise<void> {
    this.cs = this.app.get(ConfigService)
    this.fs = this.app.get(FileSystemService)
    this.validator = this.app.get(ValidatorService)
    this.parser = this.app.get(ParserService)
    this.locker = this.app.get(LockerService)

    await this.parser.register(YamlParser, JsonParser, EnvironmentVariableParser)
    this.tasks.options = {
      silentRendererCondition: true
    }
  }

  public async shouldRunAfter (): Promise<void> {
    await this.locker.all()
  }

  public async run (): Promise<void> {
    this.tasks.add([
      {
        task: async (ctx): Promise<void> => {
          ctx.files = {
            config: join(this.cs.defaults, CONFIG_FILES.INIT),
            env: join(this.cs.defaults, CONFIG_FILES.INIT_ENV),
            templates: join(this.cs.oclif.root, TEMPLATE_FOLDER)
          }

          this.jinja = jinja(this.fs, this.parser, ctx.files.templates)
        }
      },

      // loads the default configuration
      {
        task: async (ctx): Promise<void> => {
          this.logger.verbose('Loading default configuration.', { context: 'defaults' })

          ctx.config = await this.cs.read<DockerServicesConfig>(ctx.files.config)

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { services: omit, ...rest } = ctx.config

          this.logger.debug('Configuration file defaults are loaded: %o', rest, { context: 'defaults' })
        }
      },

      // check if configuration loaded to the expected directory
      {
        skip: (): boolean => {
          if (this.fs.exists(MOUNTED_CONFIG_PATH)) {
            return false
          }

          this.logger.verbose('Mounted configuration file not found at "%s", skipping merge.', MOUNTED_CONFIG_PATH, { context: 'config' })

          return true
        },
        task: async (ctx): Promise<void> => {
          ctx.config = this.cs.merge([ ctx.config, await this.cs.read(normalize(MOUNTED_CONFIG_PATH)) ])

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { services: omit, ...rest } = ctx.config

          this.logger.debug('Merged mounted configuration to defaults: %o', rest, { context: 'config' })

          this.logger.info('Extended defaults with configuration file found at "%s".', MOUNTED_CONFIG_PATH, { context: 'config' })
        }
      },

      // extend configuration with environment variables
      {
        task: async (ctx): Promise<void> => {
          ctx.config = await this.cs.env<DockerServicesConfig>(ctx.files.env, ctx.config)
        }
      },

      {
        task: async (ctx): Promise<void> => {
          ctx.config.services = ctx.config.services.map((service) => {
            return this.cs.merge<DockerService>([ ctx.config.defaults, service, { id: randomUUID() } ])
          })

          this.logger.debug('Services discovered: %o', ctx.config.services, { context: 'services' })
        }
      },

      // validate all variables
      {
        task: async (ctx): Promise<void> => {
          ctx.config = await this.validator.validate(DockerServicesConfig, ctx.config)
        }
      },

      // initiate fnm version
      {
        skip: (ctx): boolean => ctx.config.defaults.node_version === 'default',
        task: async (ctx): Promise<void> => {
          this.logger.info('Installing node version given from variables: %s', ctx.config.defaults.node_version, { context: 'node' })

          this.locker.addLock<VizierConfig>({
            data: [
              [
                {
                  name: 'fnm',
                  cwd: MOUNTED_DATA_FOLDER,
                  commands: [ `fnm install ${ctx.config.defaults.node_version}` ]
                }
              ]
            ],
            merge: MergeStrategy.EXTEND
          })
        }
      },

      // load fnm version from the root of the thingy
      {
        skip: (ctx): boolean => {
          return (
            ctx.config.defaults.node_version === 'default' && !this.fs.exists(join(MOUNTED_DATA_FOLDER, '.nvmrc')) && !this.fs.exists(join(MOUNTED_DATA_FOLDER, '.node-version'))
          )
        },
        task: async (): Promise<void> => {
          this.logger.info('Found node version override file in the root directory of the data folder.', { context: 'node' })

          this.locker.addLock<VizierConfig>({
            data: [
              [
                {
                  name: 'fnm',
                  cwd: MOUNTED_DATA_FOLDER,
                  commands: [ 'fnm install' ]
                }
              ]
            ],
            merge: MergeStrategy.EXTEND
          })
        }
      },

      // run install scripts if required
      {
        skip: (ctx): boolean => {
          if (ctx.config.dont_install) {
            this.logger.warn('dont_install is defined, will not install any dependencies in any case.')
          }

          return this.fs.exists(join(MOUNTED_DATA_FOLDER, 'node_modules')) && !ctx.config.force_install && !ctx.config.dont_install
        },
        task: async (ctx): Promise<void> => {
          if (ctx.config.force_install) {
            this.logger.info('force_install is defined, running dependency installation.', { context: 'dependencies' })
          } else {
            this.logger.info('node_modules is not found in the root of the mounted folder, running dependency installation.', { context: 'dependencies' })
          }

          let command: string

          switch (ctx.config.package_manager) {
          case 'yarn':
            command = 'yarn install'

            break

          case 'npm':
            command = 'npm install'

            break

          case 'pnpm':
            command = 'pnpm install'

            break

          default:
            this.logger.fatal('Package manager value is not known: %s', ctx.config.package_manager, { context: 'dependencies' })
          }

          if (this.fs.exists(join(MOUNTED_DATA_FOLDER, '.nvmrc')) || this.fs.exists(join(MOUNTED_DATA_FOLDER, '.node-version'))) {
            this.logger.debug('Node version file is found. appending to command.')

            command = 'fnm use && ' + command
          }

          this.locker.addLock<VizierConfig>({
            data: [
              [
                {
                  name: 'dependencies',
                  commands: [ command ],
                  cwd: MOUNTED_DATA_FOLDER
                }
              ]
            ],
            merge: MergeStrategy.EXTEND
          })
        }
      },

      // run pre scripts
      {
        skip: (ctx): boolean => !ctx.config.before_all,
        task: async (ctx): Promise<void> => {
          this.locker.addLock<VizierConfig>({
            data: [
              [
                {
                  name: 'before-all',
                  commands: ctx.config.before_all as string[],
                  cwd: MOUNTED_DATA_FOLDER
                }
              ]
            ],
            merge: MergeStrategy.EXTEND
          })
        }
      },

      // clean prior instance
      {
        task: async (): Promise<void> => {
          try {
            await this.fs.remove(VIZIER_FOLDER, { recursive: true })
          } catch (e) {
            this.logger.debug(e.message)
          }

          await this.fs.mkdir(VIZIER_FOLDER)
        }
      },

      {
        task: async (ctx): Promise<void> => {
          const enabled = ctx.config.services.filter((service) => service.enable === true)
          const disabled = ctx.config.services.filter((service) => service.enable === false)

          if (disabled.length > 0) {
            this.logger.warn(
              'Some services are disabled by configuration: %o',
              disabled.map((d) => d.name),
              { context: 'services' }
            )
          }

          this.locker.addLock<VizierConfig>({
            data: [ enabled.map((s) => this.generateLockForService(s, enabled.find((service) => service.sync) && !s.sync && s.sync_wait)) ],
            merge: MergeStrategy.EXTEND
          })

          if (enabled.length < 1) {
            throw new Error('No service is enabled at the moment. Please check the configuration.')
          }

          await this.createRunScriptForService(ctx, enabled)
        }
      }
    ])
  }

  private generateLockForService (service: DockerService, delay?: number): VizierStep {
    return {
      name: service.name,
      cwd: service.cwd,
      commands: [ join(VIZIER_FOLDER, service.id) ],
      environment: service.environment,
      delay: delay ? delay.toString() + 's' : undefined,
      log: service.log,
      ignore_error: !service.exit_on_error,
      retry: {
        retries: service.run_once ? 1 : 0,
        always: !service.run_once,
        delay: service.restart_wait.toString() + 's'
      }
    }
  }

  private async createRunScriptForService (ctx: InitCtx, services: DockerService[]): Promise<void> {
    const templatePath = join(ctx.files.templates, TEMPLATE_RUN)
    const template = await this.fs.read(templatePath)

    await Promise.all(
      services.map(async (service) => {
        const script = this.jinja.renderString(template, { service, config: ctx.config })

        const scriptPath = join(VIZIER_FOLDER, service.id)

        await this.fs.write(scriptPath, script)

        await this.fs.extra.chmod(scriptPath, '0777')

        this.logger.debug('Initiated service scripts for "%s" in directory: %s', service.cwd, VIZIER_FOLDER, { context: 'services' })
      })
    )
  }
}
