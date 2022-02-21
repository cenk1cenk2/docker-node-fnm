import { defineConfig } from 'tsup'

export default defineConfig((options) => ({
  name: !options.watch && 'production',

  entryPoints: [ 'src/**/*.ts' ],
  tsconfig: options.watch ? 'tsconfig.json' : 'tsconfig.build.json',

  dts: options.watch && true,

  target: 'es2021',
  format: [ 'cjs' ],

  sourcemap: false,

  clean: true,
  minify: true
}))
