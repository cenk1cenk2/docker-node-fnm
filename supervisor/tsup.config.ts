/* eslint-disable import/no-extraneous-dependencies */
import { execaCommand } from 'execa'
import { defineConfig } from 'tsup'

export default defineConfig((options) => ({
  name: !options.watch ? 'production' : undefined,

  entryPoints: [ 'src/**/*.ts' ],
  tsconfig: options.watch ? 'tsconfig.json' : 'tsconfig.build.json',

  dts: options.watch ? true : false,

  target: 'es2021',
  format: [ 'cjs' ],

  sourcemap: false,

  bundle: false,
  splitting: false,
  clean: true,
  minify: options.watch ? true : false,
  keepNames: true,

  onSuccess: async (): Promise<void> => {
    await Promise.all([
      execaCommand('pnpm run manifest', { stdout: process.stdout, stderr: process.stderr }),
      execaCommand('pnpm exec tsconfig-replace-paths', { stdout: process.stdout, stderr: process.stderr })
    ])
  }
}))
