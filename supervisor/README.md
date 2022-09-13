# @cenk1cenk2/oclif-boilerplate

# Description

An empty and extended oclif boilerplate.

# Navigation

<!-- toc -->
* [@cenk1cenk2/oclif-boilerplate](#cenk1cenk2oclif-boilerplate)
* [Description](#description)
* [Navigation](#navigation)
* [Further Development](#further-development)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

# Further Development

For further development you can clone this repository.

While developing you must use `export TS_NODE=1` environment variable, since I did not want to directly extend OCLIF's classes for detecting TS-Node.

`--debug` enables verbose mode, while `--inspect` creates a new inspector.

# Usage

<!-- usage -->
```sh-session
$ npm install -g docker-node-fnm-init
$ docker-node-fnm-init COMMAND
running command...
$ docker-node-fnm-init (--version)
docker-node-fnm-init/3.0.0 linux-x64 node-v18.7.0
$ docker-node-fnm-init --help [COMMAND]
USAGE
  $ docker-node-fnm-init COMMAND
...
```
<!-- usagestop -->

# Commands

<!-- commands -->
* [`docker-node-fnm-init init`](#docker-node-fnm-init-init)
* [`docker-node-fnm-init proxy`](#docker-node-fnm-init-proxy)

## `docker-node-fnm-init init`

This command initiates the container and creates the required variables.

```
USAGE
  $ docker-node-fnm-init init [--log-level
    SILENT|DIRECT|FATAL|ERROR|WARN|INFO|VERBOSE|DEBUG|TRACE|silent|direct|fatal|error|warn|info|verbose|debug|trace]
    [--ci]

CLI FLAGS
  --ci
      Instruct whether this is running the CI/CD configuration.

  --log-level=(SILENT|DIRECT|FATAL|ERROR|WARN|INFO|VERBOSE|DEBUG|TRACE|silent|direct|fatal|error|warn|info|verbose|debug
  |trace)
      [default: INFO] Set the log level of the application.

DESCRIPTION
  This command initiates the container and creates the required variables.
```

_See code: [dist/commands/init.ts](https://github.com/cenk1cenk2/boilerplate-oclif/blob/v3.0.0/dist/commands/init.ts)_

## `docker-node-fnm-init proxy`

This command initiates the proxies commands to the underlying container and pipes the data.

```
USAGE
  $ docker-node-fnm-init proxy [--log-level
    SILENT|DIRECT|FATAL|ERROR|WARN|INFO|VERBOSE|DEBUG|TRACE|silent|direct|fatal|error|warn|info|verbose|debug|trace]
    [--ci]

CLI FLAGS
  --ci
      Instruct whether this is running the CI/CD configuration.

  --log-level=(SILENT|DIRECT|FATAL|ERROR|WARN|INFO|VERBOSE|DEBUG|TRACE|silent|direct|fatal|error|warn|info|verbose|debug
  |trace)
      [default: INFO] Set the log level of the application.

DESCRIPTION
  This command initiates the proxies commands to the underlying container and pipes the data.
```

_See code: [dist/commands/proxy.ts](https://github.com/cenk1cenk2/boilerplate-oclif/blob/v3.0.0/dist/commands/proxy.ts)_
<!-- commandsstop -->
