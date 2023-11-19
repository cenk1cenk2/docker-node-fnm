#!/usr/bin/env bash

set -eo pipefail

source /etc/bash.bashrc

docker-node-fnm-init init
vizier --config-file /etc/vizier.json
