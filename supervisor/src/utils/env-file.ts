import { writeFile } from '@cenk1cenk2/boilerplate-oclif'
import { EOL } from 'os'

export function createEnvFile (path: string, variables: Record<string, string | number | boolean>, append?: boolean): Promise<void> {
  return writeFile(
    path,
    Object.entries(variables)
      .map(([ k, v ]) => `${k}=${v}`)
      .join(EOL) + EOL,
    append
  )
}
