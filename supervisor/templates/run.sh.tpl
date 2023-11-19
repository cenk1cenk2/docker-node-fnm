#!/bin/bash

source /etc/bash.bashrc
source /scripts/logger.sh

set -eo pipefail

{{ if eq .node_version "default" }}
log_warn "node version is set: {{ .node_version }}" "${CYAN}{{ .name }}${RESET}"
fnm use {{ .node_version }} --install-if-missing &>/dev/null
{{ else }}
if [ -f /data/.nvmrc ] || [ -f /data/.node-version ]; then
	(cd /data && fnm use --install-if-missing) &>/dev/null
fi
{{ end }}

{{ if .load_dotenv }}
# Get directory env variables if exists
if [[ -f .env ]]; then
	log_this "{{ .cwd }}/.env" "${CYAN}SOURCE${RESET}" "INFO"
	source .env
fi
{{ end }}

{{ if .before }}
{{ range .before }}
log_info "Running before task: $ {{ . }}"
{{ . }}
{{ end }}
{{ end }}

# Package start command
{{ .command }}
