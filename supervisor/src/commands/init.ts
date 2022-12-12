import execa from 'execa'
import { EOL } from 'os'
import { join, normalize } from 'path'
import { v4 as uuid } from 'uuid'

import { Command, fs } from '@cenk1cenk2/oclif-common'
import {
  CONFIG_FILES,
  CONTAINER_ENV_FILE,
  CONTAINER_LOCK_FILE,
  MOUNTED_CONFIG_PATH,
  MOUNTED_DATA_FOLDER,
  S6_FOLDERS,
  TEMPLATES,
  TEMPLATE_FOLDER
} from '@constants/file-system.constants'
import type { InitCtx } from '@interfaces/commands/init.interface'
import type { DockerService } from '@interfaces/configs/docker-services.interface'
import { DockerServicesConfig } from '@interfaces/configs/docker-services.interface'
import { createEnvFile } from '@utils/env-file'
import { jinja } from '@utils/jinja'

export default class Init extends Command<InitCtx> {
  static description = 'This command initiates the container and creates the required variables.'

  public async shouldRunBefore (): Promise<void> {
    this.tasks.options = {
      rendererSilent: true
    }
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

          this.logger.debug('Set defaults for context: %o', ctx, { context: 'context' })
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
          if (this.fs.exists(normalize(MOUNTED_CONFIG_PATH))) {
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
          this.logger.debug('%o', ctx.config)
        }
      },

      {
        task: (ctx): void => {
          ctx.config.services = ctx.config.services.map((service) => {
            return this.cs.merge([ ctx.config.defaults, service ]) as DockerService
          })

          this.logger.debug('Merged default configuration to all services: %o', ctx.config.defaults, { context: 'defaults' })
        }
      },

      // normalize variables
      {
        task: async (ctx): Promise<void> => {
          // service names
          await Promise.all(
            ctx.config.services.map(async (service) => {
              service.id = uuid()
              service.name = service.name ?? service.cwd

              // we wrap this inside "" so have to escape it all
              service.parsed_command = service.command.replaceAll('"', '\\"')

              if (Array.isArray(service.before) && service.before.length > 0) {
                service.before = service.before.map((b) => b.replaceAll('"', '\\"'))
              }

              if (service.environment && Object.keys(service.environment).length > 0) {
                service.parsed_environment = Object.entries(service.environment).reduce((o, [ envKey, envValue ]) => o + `export ${envKey}=${envValue}` + EOL, '')
              }
            })
          )

          this.logger.debug('Services discovered: %o', ctx.config.services, { context: 'services' })
        }
      },

      // validate all variables
      {
        task: async (ctx): Promise<void> => {
          await this.validator.validate(DockerServicesConfig, ctx.config)
        }
      },

      // initiate fnm version
      {
        skip: (ctx): boolean => ctx.config.node_version === 'default',
        task: async (ctx): Promise<void> => {
          this.logger.info('Installing node version given from variables: %s', ctx.config.node_version, { context: 'node' })

          try {
            await this.pipeProcessToLogger(
              execa('fnm', [ 'install', ctx.config.node_version ], {
                shell: '/bin/bash',
                detached: false,
                extendEnv: false
              }),
              { context: 'fnm' }
            )
          } catch (e) {
            this.logger.fatal('Can not use the given version with FNM.', { context: 'fnm' })

            this.logger.error('%o', e, { context: 'fnm' })

            this.exit(120)
          }
        }
      },

      // load fnm version from the root of the thingy
      {
        skip: (ctx): boolean =>
          ctx.config.node_version === 'default' && !this.fs.exists(join(MOUNTED_DATA_FOLDER, '.nvmrc')) && !this.fs.exists(join(MOUNTED_DATA_FOLDER, '.node-version')),
        task: async (): Promise<void> => {
          this.logger.info('Found node version override file in the root directory of the data folder.', { context: 'node' })

          try {
            await this.pipeProcessToLogger(
              execa('fnm', [ 'install' ], {
                shell: '/bin/bash',
                detached: false,
                extendEnv: false,
                cwd: MOUNTED_DATA_FOLDER
              }),
              { context: 'fnm' }
            )
          } catch (e) {
            this.logger.fatal('Can not use the workspace version with FNM.', { context: 'fnm' })

            this.logger.error('%o', e, { context: 'fnm' })

            this.exit(120)
          }
        }
      },

      // check all the given cwds exists
      {
        skip: (ctx): boolean => !ctx.config.check_directories,
        task: async (ctx): Promise<void> => {
          const errors: string[] = []

          await Promise.all(
            ctx.config.services.map(async (service, i) => {
              const dir = join(MOUNTED_DATA_FOLDER, service.cwd)

              try {
                const stat = this.fs.stats(dir)

                if (!stat.isDirectory()) {
                  errors.push(`Specified directory "${dir}" is not a directory for service ${i}.`)
                }
              } catch {
                errors.push(`Specified directory "${dir}" does not exists for service ${i}.`)
              }
            })
          )

          if (errors.length > 0) {
            errors.forEach((error) => this.logger.fatal(error, { context: 'services' }))

            this.exit(120)
          }
        }
      },

      // clean prior instance
      {
        task: async (): Promise<void> => {
          try {
            await Promise.all([ S6_FOLDERS.service, CONTAINER_ENV_FILE, CONTAINER_LOCK_FILE ].map((f) => this.fs.remove(f, { recursive: true })))
          } catch (e) {
            this.logger.debug(e.message)
          }

          try {
            await this.fs.mkdir(S6_FOLDERS.service)
          } catch (e) {
            this.logger.debug(e.message)
          }
        }
      },

      // init variables for s6
      {
        task: async (ctx): Promise<void> => {
          await createEnvFile(CONTAINER_ENV_FILE, {
            PACKAGE_MANAGER: ctx.config.package_manager,
            FORCE_INSTALL: ctx.config.force_install,
            NODE_VERSION: ctx.config.node_version
          })

          if (this.cs.isDebug) {
            return createEnvFile(CONTAINER_ENV_FILE, { LOG_LEVEL: 5 }, true)
          }

          return createEnvFile(CONTAINER_ENV_FILE, { LOG_LEVEL: 4 }, true)
        }
      },

      // init services for s6 supervisor
      {
        task: async (ctx): Promise<void> => {
          const enabled = ctx.config.services.filter((service) => service.enable === true)
          const disabled = ctx.config.services.filter((service) => service.enable === false)
          const preliminary = enabled.filter((service) => service.sync === true)

          if (disabled.length > 0) {
            this.logger.warn('Some services are disabled by configuration: %s', disabled.map((d) => d.cwd).join(', '), { context: 'services' })
          }

          if (preliminary.length > 0) {
            await createEnvFile(CONTAINER_LOCK_FILE, { PRELIMINARY_SERVICES: `(${preliminary.map((s) => s.id).join(' ')})`, FIRST_SERVICE: true })

            this.logger.debug('Wrote lock file for preliminary services.', { context: 'preliminary-services' })
          }

          if (enabled.length < 1) {
            this.logger.fatal('No service is enabled at the moment. Please check the configuration.')

            this.exit(120)
          }

          await this.createRunScriptForService(ctx, enabled)
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

          if (ctx.config.package_manager === 'yarn') {
            command = 'yarn install'
          } else if (ctx.config.package_manager === 'npm') {
            command = 'npm install'
          } else {
            this.logger.fatal('Package manager value is not known: %s', ctx.config.package_manager, { context: 'dependencies' })
          }

          if (this.fs.exists(join(MOUNTED_DATA_FOLDER, '.nvmrc')) || this.fs.exists(join(MOUNTED_DATA_FOLDER, '.node-version'))) {
            this.logger.debug('Node version file is found. appending to command.')

            command = 'fnm use && ' + command
          }

          await this.pipeProcessToLogger(
            execa.command(`${command}`, {
              shell: '/bin/bash',
              detached: false,
              extendEnv: false,
              cwd: MOUNTED_DATA_FOLDER
            }),
            { context: 'fnm' }
          )
        }
      },

      // run pre scripts
      {
        skip: (ctx): boolean => !ctx.config.before_all,
        task: async (ctx): Promise<void> => {
          this.logger.info('before_all is defined, running commands before starting services.', { context: 'before-all' })

          for (const command of ctx.config.before_all as string[]) {
            this.logger.info(`$ ${command}`, { context: 'before-all' })

            await this.pipeProcessToLogger(
              execa.command(command, {
                shell: '/bin/bash',
                detached: false,
                extendEnv: false,
                cwd: MOUNTED_DATA_FOLDER
              }),
              { context: 'before-all' }
            )
          }
        }
      }
    ])
  }

  private async createRunScriptForService (ctx: InitCtx, services: DockerService[]): Promise<void> {
    const runTemplatePath = join(ctx.files.templates, TEMPLATES.run)
    const runTemplate = await this.fs.read(runTemplatePath)
    const finishTemplatePath = join(ctx.files.templates, TEMPLATES.finish)
    const finishTemplate = await this.fs.read(finishTemplatePath)

    await Promise.all(
      services.map(async (service) => {
        const runScriptTemplate = jinja(ctx.files.templates).renderString(runTemplate, { service, config: ctx.config })
        const finishScriptTemplate = jinja(ctx.files.templates).renderString(finishTemplate, { service, config: ctx.config })

        const serviceDir = join(S6_FOLDERS.service, service.id)
        const runScriptPath = join(serviceDir, S6_FOLDERS.runScriptName)
        const finishScriptPath = join(serviceDir, S6_FOLDERS.finishScriptName)

        await this.fs.mkdir(serviceDir)

        await Promise.all([ this.fs.write(runScriptPath, runScriptTemplate), this.fs.write(finishScriptPath, finishScriptTemplate) ])

        await Promise.all([ fs.chmod(runScriptPath, '0777'), fs.chmod(finishScriptPath, '0777') ])

        this.logger.debug('Initiated service scripts for "%s" in directory: %s', service.cwd, serviceDir, { context: 'services' })
      })
    )
  }
}
