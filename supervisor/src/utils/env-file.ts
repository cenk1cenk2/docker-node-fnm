import { EOL } from 'os'

import { FileSystemService } from '@cenk1cenk2/oclif-common'

export function createEnvFile (path: string, variables: Record<string, string | number | boolean>, append?: boolean): Promise<void> {
  const fs = new FileSystemService()

  return fs[append ? 'append' : 'write'](
    path,
    Object.entries(variables)
      .map(([ k, v ]) => `${k}=${v}`)
      .join(EOL) + EOL
  )
}
