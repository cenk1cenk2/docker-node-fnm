#!/bin/bash

source /root/.bashrc
source /scripts/logger.sh
source /.env

cd /data

[ ! -d 'node_modules' ] && log_warn "'node_modules/' folder not found in cwd. Will install dependencies." && INSTALL_DEPENDENCIES=true
[ "${FORCE_INSTALL}" == "true" ] && log_warn "Force installing dependencies is defined. Will install dependencies." && INSTALL_DEPENDENCIES=true

if [ -n "${INSTALL_DEPENDENCIES}" ]; then
	if [ "${PACKAGE_MANAGER}" == "yarn" ]; then
		yarn
	elif [ "${PACKAGE_MANAGER}" == "npm" ]; then
		npm i
	else
		log_error "Package manager unknown."

		exit 127
	fi
fi
