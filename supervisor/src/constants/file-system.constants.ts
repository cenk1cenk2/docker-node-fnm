import { join } from 'path'

export const MOUNTED_DATA_FOLDER = '/data'

export const MOUNTED_CONFIG_FOLDER = '/config'

export const MOUNTED_CONFIG_PATH = join(MOUNTED_CONFIG_FOLDER, 'services.yml')

export const TEMPLATE_FOLDER = 'templates'

export const TEMPLATES = {
  run: 'run.sh.j2',
  finish: 'finish.sh.j2'
}

export const CONTAINER_ENV_FILE = '/.env'
export const CONTAINER_LOCK_FILE = '/.lock'
export const YAML_FILE_EXT = 'yml'
export const DEFAULT_CONFIG_FILE = 'default.yml'

export const S6_FOLDERS = {
  service: '/etc/services.d',
  runScriptName: 'run',
  finishScriptName: 'finish'
}

export const CONFIG_FILES = {
  INIT: 'init',
  PROXY: 'proxy'
}
