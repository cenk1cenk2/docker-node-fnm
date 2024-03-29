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
import { CONFIG_FILES, MOUNTED_CONFIG_PATH, MOUNTED_DATA_FOLDER, TEMPLATE_FOLDER, TEMPLATE_RUN, TEMPLATE_SERVICE, VIZIER_CONFIG_FILE } from '@constants'
import type { DockerService, InitCtx, RunScriptTemplate, ServiceScriptTemplate, VizierConfig, VizierStep } from '@interfaces'
import { DockerServicesConfig } from '@interfaces'

export default class Init extends Command<typeof Init, InitCtx> implements ShouldRunBeforeHook, ShouldRunAfterHook<InitCtx>, RegisterHook {
  static description = 'This command initiates the container and creates the required variables.'

  private cs: ConfigService
  private fs: FileSystemService
  private validator: ValidatorService
  private parser: ParserService
  private locker: LockerService<VizierConfig>

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
    await this.locker.lockAll()
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
            data: {
              steps: [
                {
                  name: 'fnm',
                  commands: [
                    {
                      cwd: MOUNTED_DATA_FOLDER,
                      command: `fnm install ${ctx.config.defaults.node_version}`
                    }
                  ]
                }
              ]
            },
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
        task: async (ctx): Promise<void> => {
          ctx.config.defaults.node_version =
            this.fs.exists(join(MOUNTED_DATA_FOLDER, '.nvmrc')) && await this.fs.read(join(MOUNTED_DATA_FOLDER, '.nvmrc')) ||
            this.fs.exists(join(MOUNTED_DATA_FOLDER, '.node-version')) && await this.fs.read(join(MOUNTED_DATA_FOLDER, '.node-version'))

          ctx.config.defaults.node_version = ctx.config.defaults.node_version.trim()

          ctx.config.services.forEach((service) => {
            if (service.node_version === 'default') {
              service.node_version = ctx.config.defaults.node_version
            }
          })

          this.logger.info('Found node version override file in the root directory of the data folder: using %s', ctx.config.defaults.node_version)

          this.locker.addLock<VizierConfig>({
            data: {
              steps: [
                {
                  name: 'fnm',
                  commands: [
                    {
                      cwd: MOUNTED_DATA_FOLDER,
                      command: 'fnm install'
                    }
                  ]
                }
              ]
            },
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

          const commands: string[] = []
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

            commands.push('fnm use')
          }

          commands.push(command)

          this.locker.addLock<VizierConfig>({
            data: {
              steps: [
                {
                  name: 'dependencies',
                  commands: [
                    {
                      cwd: MOUNTED_DATA_FOLDER,
                      command: '/usr/bin/env bash',
                      script: {
                        file: join(ctx.files.templates, TEMPLATE_RUN),
                        ctx: { commands } satisfies RunScriptTemplate
                      }
                    }
                  ]
                }
              ]
            },
            merge: MergeStrategy.EXTEND
          })
        }
      },

      // run pre scripts
      {
        skip: (ctx): boolean => !ctx.config.before_all,
        task: async (ctx): Promise<void> => {
          this.locker.addLock<VizierConfig>({
            data: {
              steps: [
                {
                  name: 'before-all',
                  commands: [
                    {
                      cwd: MOUNTED_DATA_FOLDER,
                      command: '/usr/bin/env bash',
                      script: {
                        file: join(ctx.files.templates, TEMPLATE_RUN),
                        ctx: { commands: ctx.config.before_all as string[] } satisfies RunScriptTemplate
                      }
                    }
                  ]
                }
              ]
            },
            merge: MergeStrategy.EXTEND
          })
        }
      },

      // clean prior instance
      {
        task: async (): Promise<void> => {
          try {
            await this.fs.remove(VIZIER_CONFIG_FILE, { recursive: true })
          } catch (e) {
            this.logger.debug(e.message)
          }
        }
      },

      {
        task: async (ctx): Promise<void> => {
          this.logger.debug('Services discovered: %o', ctx.config.services, { context: 'services' })

          this.locker.addLock<VizierConfig>({
            data: {
              steps: [
                ctx.config.services.reduce<VizierStep>(
                  (o, service) => {
                    const delay = ctx.config.services.filter((service) => service.sync).length > 0 && !service.sync && service.sync_wait

                    o.commands.push({
                      parallel: true,
                      shouldDisable: !service.enable,
                      name: service.name,
                      cwd: service.cwd,
                      command: '/usr/bin/env bash',
                      script: {
                        file: join(ctx.files.templates, TEMPLATE_SERVICE),
                        ctx: service satisfies ServiceScriptTemplate
                      },
                      log: service.log,
                      environment: service.environment,
                      health: {
                        ignoreError: !service.exit_on_error
                      },
                      retry: {
                        retries: service.run_once ? 1 : undefined,
                        always: !service.run_once,
                        delay: service.restart_wait.toString() + 's'
                      },
                      delay: delay ? delay.toString() + 's' : undefined
                    })

                    return o
                  },
                  { commands: [] }
                )
              ]
            },
            merge: MergeStrategy.EXTEND
          })
        }
      }
    ])
  }
}
