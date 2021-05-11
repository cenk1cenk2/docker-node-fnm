FROM debian:stable-slim

# Workdir for node package

ARG FNM_VERSION=1.24.0
ENV FNM_DIR /opt/fnm
ENV FNM_INTERACTIVE_CLI false
ENV FNM_INSTALL_VERSION 16

WORKDIR /tmp

# Install Tini and git for node packages
RUN apt-get update && apt-get install -y tini curl unzip && \
  # install fnm
  curl -fsSL https://fnm.vercel.app/install | bash -s -- --install-dir "/opt/fnm" --skip-shell && \
  ln -s /opt/fnm/fnm /usr/bin/ && chmod +x /usr/bin/fnm && \
  # clean up build dependencies
  # clean up tmp
  rm -rf /tmp/* && \
  # clean up dependencies
  apt-get remove -y curl unzip && apt-get autoremove -y && \
  # add fnm for bash
  printf 'eval "$(fnm env --shell bash)"'>> /root/.bashrc && \
  # smoke test for fnm
  /bin/bash -c "fnm -V" && \
  # install latest node version as default
  /bin/bash -c "fnm install ${FNM_INSTALL_VERSION}" && \
  /bin/bash -c "fnm alias default ${FNM_INSTALL_VERSION}" && \
  /bin/bash -c "source /root/.bashrc && fnm use default" && \
  /bin/bash -c "source /root/.bashrc && npm -g i yarn" && \
  # smoke test
  /bin/bash -c "source /root/.bashrc && node -v" && \
  /bin/bash -c "source /root/.bashrc && npm -v" && \
  /bin/bash -c "source /root/.bashrc && yarn -v"

# Copy the supervisor
COPY ./supervisor /init

# Link and install dependencies
WORKDIR /init
RUN /bin/bash -c "source /root/.bashrc && yarn --production && yarn link" && \
  # smoke test
  /bin/bash -c "source /root/.bashrc && docker-node-fnm-init -v"

WORKDIR /data

# Create custom entrypoint supports environment variables
RUN printf "#!/bin/bash\nsource /root/.bashrc\ndocker-node-fnm-init" > /entrypoint.sh && \
  chmod +x /entrypoint.sh

ENTRYPOINT ["tini", "-g", "--", "/entrypoint.sh"]
