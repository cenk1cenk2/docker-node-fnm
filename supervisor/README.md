# @cenk1cenk2/oclif-boilerplate

# Description

An empty and extended oclif boilerplate.

# Navigation

<!-- toc -->

- [Description](#description)
- [Navigation](#navigation)
- [Further Development](#further-development)
- [Usage](#usage)
- [Commands](#commands)
<!-- tocstop -->

# Further Development

For further development you can clone this repository.

While developing you must use `export TS_NODE=1` environment variable, since I did not want to directly extend OCLIF's classes for detecting TS-Node.

`--debug` enables verbose mode, while `--inspect` creates a new inspector.

# Usage

<!-- usage -->

```sh-session
$ npm install -g @cenk1cenk2/oclif-boilerplate
$ cenk1cenk2 COMMAND
running command...
$ cenk1cenk2 (-v|--version|version)
@cenk1cenk2/oclif-boilerplate/0.0.0 linux-x64 node-v13.12.0
$ cenk1cenk2 --help [COMMAND]
USAGE
  $ cenk1cenk2 COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

- [`cenk1cenk2 config`](#cenk1cenk2-config)
- [`cenk1cenk2 empty [FILE]`](#cenk1cenk2-empty-file)
- [`cenk1cenk2 help [COMMAND]`](#cenk1cenk2-help-command)

## `cenk1cenk2 config`

Various ways to edit default configuration.

```
USAGE
  $ cenk1cenk2 config
```

## `cenk1cenk2 empty [FILE]`

describe the command here

```
USAGE
  $ cenk1cenk2 empty [FILE]

OPTIONS
  -f, --force
  -h, --help   show CLI help
```

## `cenk1cenk2 help [COMMAND]`

display help for cenk1cenk2

```
USAGE
  $ cenk1cenk2 help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.0.1/src/commands/help.ts)_

<!-- commandsstop -->
