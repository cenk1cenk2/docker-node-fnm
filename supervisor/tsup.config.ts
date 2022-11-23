/* eslint-disable import/no-extraneous-dependencies */
import { defineConfig } from 'tsup'

export default defineConfig((options) => ({
  name: !options.watch ? 'production' : undefined,

  entryPoints: [ 'src/**/*.ts' ],
  tsconfig: options.watch ? 'tsconfig.json' : 'tsconfig.build.json',

  dts: options.watch && true,

  target: 'es2021',
  format: [ 'cjs' ],

  sourcemap: false,

  bundle: false,
  clean: true,
  minify: true
}))
