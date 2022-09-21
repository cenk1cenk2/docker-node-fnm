/* eslint-disable import/no-extraneous-dependencies */
import { esbuildDecorators } from '@anatine/esbuild-decorators'
import { defineConfig } from 'tsup'

export default defineConfig((options) => ({
  name: !options.watch && 'production',

  entryPoints: [ 'src/**/*.ts' ],
  tsconfig: options.watch ? 'tsconfig.json' : 'tsconfig.build.json',

  dts: options.watch && true,

  target: 'es2021',
  format: [ 'cjs' ],

  sourcemap: false,

  esbuildPlugins: [ esbuildDecorators() ],

  clean: true,
  minify: true
}))
