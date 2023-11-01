/* eslint-disable import/no-extraneous-dependencies */
import { execaCommand } from 'execa'
import { defineConfig } from 'tsup'

export default defineConfig((options) => ({
  name: !options.watch ? 'production' : undefined,

  entryPoints: ['./src/**'],
  tsconfig: options.watch ? 'tsconfig.json' : 'tsconfig.build.json',

  dts: options.watch ? true : false,

  target: 'es2022',
  format: ['esm'],

  sourcemap: true,

  bundle: false,
  splitting: false,
  clean: true,
  minify: false,
  keepNames: true,

  onSuccess: async (): Promise<void> => {
    await execaCommand('pnpm exec tsconfig-replace-paths', { stdout: process.stdout, stderr: process.stderr })
    await execaCommand('pnpm run manifest', { stdout: process.stdout, stderr: process.stderr })
  }
}))
