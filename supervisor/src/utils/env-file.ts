import { EnvironmentVariableParser, FileSystemService } from '@cenk1cenk2/oclif-common'

export function createEnvFile (path: string, variables: Record<string, string | number | boolean>, append?: boolean): Promise<void> {
  const fs = new FileSystemService()
  const parser = new EnvironmentVariableParser()

  return fs[append ? 'append' : 'write'](path, parser.stringify(variables))
}
