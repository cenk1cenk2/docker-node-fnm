import { toYaml } from '@cenk1cenk2/boilerplate-oclif'
import fs from 'fs-extra'
import Nunjucks from 'nunjucks'
import { dirname, isAbsolute, join } from 'path'

export function jinja (path: string): Nunjucks.Environment {
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
        const buffer = fs.readFileSync(dir, 'utf-8')

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
    return toYaml(data).trim()
  })

  // add extensions

  return env
}
