#!/usr/bin/env node

process.env.FORCE_COLOR = 3

require('@cenk1cenk2/boilerplate-oclif/bin/run')

require('@oclif/command').run().catch(require('@oclif/errors/handle'))
