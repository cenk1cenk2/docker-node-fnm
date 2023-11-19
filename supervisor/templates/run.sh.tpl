source /etc/bash.bashrc

set -eo pipefail

{{ range .commands }}
{{ . }}
{{ end }}

exit
