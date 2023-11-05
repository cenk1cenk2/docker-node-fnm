#!/usr/bin/env bash

source /etc/bash.bashrc

docker-node-fnm-init init
vizier --config /etc/vizier/config.json
