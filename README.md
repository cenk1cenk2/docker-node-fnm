# cenk1cenk2/node-fnm

[![Build Status](https://drone.kilic.dev/api/badges/cenk1cenk2/docker-node-fnm/status.svg)](https://drone.kilic.dev/cenk1cenk2/docker-node-fnm) [![Docker Pulls](https://img.shields.io/docker/pulls/cenk1cenk2/node-fnm)](https://hub.docker.com/repository/docker/cenk1cenk2/node-fnm) [![Docker Image Size (latest by date)](https://img.shields.io/docker/image-size/cenk1cenk2/node-fnm)](https://hub.docker.com/repository/docker/cenk1cenk2/node-fnm) [![Docker Image Version (latest by date)](https://img.shields.io/docker/v/cenk1cenk2/node-fnm)](https://hub.docker.com/repository/docker/cenk1cenk2/node-fnm) [![GitHub last commit](https://img.shields.io/github/last-commit/cenk1cenk2/docker-node-fnm)](https://github.com/cenk1cenk2/docker-node-fnm)

# Description

Docker container with `fnm` installed that is capable of running monorepos in one container through `s6-overlay`.

<!-- toc -->

- [Methodology](#methodology)
- [Use Case](#use-case)
- [Configuration](#configuration)
  - [Configuration File](#configuration-file)
  - [Environment Variables](#environment-variables)
    - [Container Settings](#container-settings)
    - [Global Settings](#global-settings)
    - [Defaults](#defaults)
    - [Services](#services)
- [Deploy](#deploy)

<!-- tocstop -->

---

# Methodology

- CLI will run and parse your variables and generate scripts for each service for `s6-overlay`.
- CLI will install specific node version if defined in the configuration file or by `.node-version` or `.nvmrc` file in the root folder. Otherwise it will use the default version, which is the latest.
- Script will install dependencies if `node_modules` is missing in the root folder or `force_install` option is enabled.
- `s6-overlay` will take care of the rest, and will start and monitor the services to restart the dead ones.

# Use Case

This container is useful in cases:

- where you want to run multiple node services as in the case of a monorepo inside the same container.
- where you want to restart the services if it crashes.
- use a specific node version pinned with `fnm` or `nvm`.

# Configuration

Configuration can be done in multiple ways and they load in a specific order that proceeds each other.

The application will:

- Load the default configuration which is [default.yml](./supervisor/config/defaults/default.yml).
- Check for mounted configuration file at `/config/services.yml`, merge it with the default one.
- Look for environment variables that can overwrite individual properties.

## Configuration File

A yaml configuration file can be mounted to container at `/config/services.yml`. This will be merged with the defaults, which is exactly the example below.

```yaml
# global settings
node_version: default # set the node version, overwrites the nvmrc file in the root. version that can fnm or nvm can accept
package_manager: yarn # valid values npm, yarn
force_install: false # to add --force flag to the package manager for initial start
sync_wait: 10 # wait between the services a pre-given time if sync is true
check_directories: true # whether to check the given cwd directories to exist or not

# default settings will be injected to all the services
defaults:
  enable: true # enables or disables a service
  before: false # a command to run before the task, can be an array of commands or false
  logs: false # logs can be 'true' for logging the service, 'false' for disabling the logs and 'prefix' for prefixing all services with their cwd
  load_dotenv: true # if the flag is set, this will load the .env file in the service.cwd
  command: yarn dev:start # default command to run
  sync: false # this will run the sync flagged services first and one-by-one with the sync_wait and run the others afterwards
  # Object for passing in environment variables to services
  # environment:

# definition of the services, will overwrite the defaults for each service
# you can use the same settings in the defaults here as well
services:
  - cwd: . # current working directory relative to /data
    # name: # you can give a friendly name to the service, if empty it will use the cwd
    logs: true # logs can be 'true' for logging the service, 'false' for disabling the logs and 'prefix' for prefixing all services with their cwd
    command: yarn dev:start
```

## Environment Variables

### Container Settings

| Environment Variable | Format                                                                     | description |
| -------------------- | -------------------------------------------------------------------------- | ----------- |
| LOG_LEVEL            | 'debug' \| 'verbose '\| 'module' \| 'info' \| 'warn' \| 'error' \| 'fatal' |

### Global Settings

| Environment Variable | Format          | description |
| -------------------- | --------------- | ----------- |
| NODE_VERSION         | string          |
| PACKAGE_MANAGER      | 'yarn' \| 'npm' |
| FORCE_INSTALL        | boolean         |
| SYNC_WAIT            | number          | in seconds  |
| CHECK_DIRECTORIES    | boolean         |

### Defaults

| Environment Variable | Format                    | description    |
| -------------------- | ------------------------- | -------------- |
| DEFAULTS_ENABLE      | boolean                   |
| DEFAULTS_BEFORE      | json                      | in array form  |
| DEFALTS_LOGS         | true \| false \| 'prefix' |
| DEFAULTS_LOAD_DOTENV | boolean                   |
| DEFAULTS_COMMAND     | string                    |
| DEFAULTS_SYNC        | boolean                   |
| DEFAULTS_ENVIRONMENT | json                      | in object form |

### Services

### Passing in a Base

| Environment Variable | Format | description   |
| -------------------- | ------ | ------------- |
| SERVICES             | json   | in array form |

### Extending per Service

Service extension variables can be defined in the form of `SERVICE_${serviceNumberInsideTheArray}_${variable.name}`.

So if you want to modify a property from the 0th service in the services array it should be like `SERVICE_0_PROPERTY`.

| Environment Variable       | Format                    | description    |
| -------------------------- | ------------------------- | -------------- |
| SERVICE\_${i}\_CWD         | string                    | required       |
| SERVICE\_${i}\_NAME        | string                    |
| SERVICE\_${i}\_ENABLE      | boolean                   |
| SERVICE\_${i}\_BEFORE      | json                      | in array form  |
| SERVICE\_${i}\_LOGS        | true \| false \| 'prefix' |
| SERVICE\_${i}\_LOAD_DOTENV | boolean                   |
| SERVICE\_${i}\_COMMAND     | string                    |
| SERVICE\_${i}\_SYNC        | boolean                   |
| SERVICE\_${i}\_ENVIRONMENT | json                      | in object form |

# Deploy

Image name: `cenk1cenk2/node-fnm`

Mount your application root to `/data` in the container. [Check configuration](#configuration) for defining your services.
