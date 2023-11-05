import { join } from 'path'

export const MOUNTED_DATA_FOLDER = '/data'

export const MOUNTED_CONFIG_FOLDER = '/config'

export const MOUNTED_CONFIG_PATH = join(MOUNTED_CONFIG_FOLDER, 'services.yml')

export const TEMPLATE_FOLDER = 'templates'

export const VIZIER_FOLDER = '/etc/vizier'
export const VIZIER_CONFIG_FILE = join(VIZIER_FOLDER, 'config.json')

export const TEMPLATE_RUN = 'run.sh.j2'

export const CONFIG_FILES = {
  INIT: 'init.yml',
  INIT_ENV: 'init.env.yml',
  PROXY: 'proxy.yml',
  PROXY_ENV: 'proxy.env.yml'
}
