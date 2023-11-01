/* eslint-disable import/no-extraneous-dependencies */
import { execaCommand } from 'execa'
import { defineConfig } from 'tsup'

export default defineConfig((options) => ({
  name: !options.watch ? 'production' : undefined,

  entryPoints: { 'commands/init': './src/commands/init.ts', 'commands/proxy': './src/commands/proxy.ts', 'hooks/not-found.hook': './src/hooks/not-found.hook.ts' },
  tsconfig: options.watch ? 'tsconfig.json' : 'tsconfig.build.json',

  dts: options.watch ? true : false,

  target: 'es2022',
  format: ['esm'],

  sourcemap: false,

  bundle: true,
  splitting: false,
  clean: true,
  minify: options.watch ? true : false,
  keepNames: true,

  onSuccess: async (): Promise<void> => {
    // await execaCommand('pnpm exec tsconfig-replace-paths', { stdout: process.stdout, stderr: process.stderr })
    await execaCommand('pnpm run manifest', { stdout: process.stdout, stderr: process.stderr })
  }
}))
