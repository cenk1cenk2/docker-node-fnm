import Nunjucks from 'nunjucks'
import { dirname, isAbsolute, join } from 'path'

import type { Jinja } from './jinja.interface.js'
import type { FileSystemService, ParserService } from '@cenk1cenk2/oclif-common'
import { YamlParser } from '@cenk1cenk2/oclif-common'

export function jinja (fs: FileSystemService, parser: ParserService, path: string): Jinja {
  const yaml = parser.fetch(YamlParser)

  // some trickery because of the types of nunjucks
  Nunjucks.installJinjaCompat()

  const env = new Nunjucks.Environment(
    {
      async: false,
      getSource: (name: string): Nunjucks.LoaderSource => {
        name = name.trim()
        const relative = !isAbsolute(name)
        const dir = relative ? join(dirname(path), name) : name

        // async read does not work, dont waste 1 hour on it!
        const buffer = fs.readSync(dir)

        return {
          src: buffer,
          path: name,
          noCache: false
        }
      }
    },
    {
      autoescape: false,
      throwOnUndefined: true,
      trimBlocks: true,
      lstripBlocks: true
    }
  )

  // add filters
  env.addFilter('to_nice_yaml', (data: string | string[] | Record<string, any>) => {
    return yaml.stringify(data).trim()
  })

  // add extensions

  return env
}
