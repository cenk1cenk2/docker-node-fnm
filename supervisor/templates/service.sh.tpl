source /etc/bash.bashrc

set -eo pipefail

fnm use {{ .node_version }} --install-if-missing

{{ if .before }}
{{ range .before }}
echo "Running before task: $ {{ . }}"
{{ . }}
{{ end }}
{{ end }}

# Package start command
{{ .command }}

exit
