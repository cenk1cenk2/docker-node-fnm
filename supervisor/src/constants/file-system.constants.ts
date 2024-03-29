import { join } from 'path'

export const MOUNTED_DATA_FOLDER = '/data'

export const MOUNTED_CONFIG_FOLDER = '/config'

export const MOUNTED_CONFIG_PATH = join(MOUNTED_CONFIG_FOLDER, 'services.yml')

export const TEMPLATE_FOLDER = 'templates'

export const VIZIER_CONFIG_FILE = join('/etc', 'vizier.json')

export const TEMPLATE_SERVICE = 'service.sh.tpl'
export const TEMPLATE_RUN = 'run.sh.tpl'

export const CONFIG_FILES = {
  INIT: 'init.yml',
  INIT_ENV: 'init.env.yml',
  PROXY: 'proxy.yml',
  PROXY_ENV: 'proxy.env.yml'
}
