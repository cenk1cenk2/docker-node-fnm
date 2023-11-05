#!/usr/bin/env node

process.env.FORCE_COLOR = 3

const { execute } = await import('@oclif/core')

await import('source-map-support').then((lib) => lib.install())

await import('@cenk1cenk2/oclif-common').then((lib) => lib.setup())
await execute({ dir: import.meta.url })
