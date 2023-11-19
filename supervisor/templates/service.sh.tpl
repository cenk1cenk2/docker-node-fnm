source /etc/bash.bashrc

set -eo pipefail

{{ if eq .node_version "default" }}
if [ -f /data/.nvmrc ] || [ -f /data/.node-version ]; then
	(cd /data && fnm use --install-if-missing) &>/dev/null
fi
{{ else }}
echo "node version is set: {{ .node_version }}"
fnm use {{ .node_version }} --install-if-missing &>/dev/null
{{ end }}

{{ if .load_dotenv }}
# Get directory env variables if exists
if [[ -f .env ]]; then
	echo "source: {{ .cwd }}/.env"
	source .env
fi
{{ end }}

{{ if .before }}
{{ range .before }}
echo "Running before task: $ {{ . }}"
{{ . }}
{{ end }}
{{ end }}

# Package start command
{{ .command }}

exit
