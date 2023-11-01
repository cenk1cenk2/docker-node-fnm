#!/usr/bin/env node

process.env.FORCE_COLOR = 3

async function main () {
  const { execute } = await import('@oclif/core')

  await import('@cenk1cenk2/oclif-common').then((lib) => lib.setup())
  await execute({ dir: import.meta.url })
}

await main()
