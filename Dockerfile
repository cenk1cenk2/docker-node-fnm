# syntax=docker/dockerfile-upstream:master-labs
FROM debian:stable-slim

ARG S6_OVERLAY_ARCH

# Workdir for node package

ENV FNM_VERSION 1.31.1
ENV S6_VERSION 2.2.0.3
ENV FNM_DIR /opt/fnm
ENV FNM_INTERACTIVE_CLI false
ENV FNM_INSTALL_VERSION 20

WORKDIR /tmp

COPY ./rootfs /

# Install s6 overlay
ADD https://github.com/just-containers/s6-overlay/releases/download/v${S6_VERSION}/s6-overlay-${S6_OVERLAY_ARCH}.tar.gz /tmp/
RUN tar xzf "/tmp/s6-overlay-${S6_OVERLAY_ARCH}.tar.gz" -C / && \
  # create directories
  mkdir -p /etc/services.d && mkdir -p /etc/cont-init.d && mkdir -p /s6-bin && \
  rm -rf /tmp/*

SHELL ["/bin/bash", "-c"]

# Install fnm and initiate it
RUN \
  apt-get update && \
  apt-get install -y curl unzip gnupg2 && \
  # install fnm
  curl -fsSL https://fnm.vercel.app/install | bash -s -- --install-dir "/opt/fnm" --skip-shell && \
  ln -s /opt/fnm/fnm /usr/bin/ && chmod +x /usr/bin/fnm && \
  # smoke test for fnm
  fnm -V && \
  # install latest node version as default
  /bin/bash -c "source /etc/bash.bashrc && fnm install ${FNM_INSTALL_VERSION}" && \
  /bin/bash -c "source /etc/bash.bashrc && fnm alias default ${FNM_INSTALL_VERSION}" && \
  # add fnm for bash
  /bin/bash -c "source /etc/bash.bashrc && fnm use default" && \
  /bin/bash -c 'source /etc/bash.bashrc && /bin/ln -s "/opt/fnm/aliases/default/bin/node" /usr/bin/node' && \
  /bin/bash -c 'source /etc/bash.bashrc && /bin/ln -s "/opt/fnm/aliases/default/bin/npm" /usr/bin/npm' && \
  /bin/bash -c 'source /etc/bash.bashrc && /bin/ln -s "/opt/fnm/aliases/default/bin/npx" /usr/bin/npx' && \
  # add yarn
  curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
  echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
  apt-get update && apt-get install -y --no-install-recommends yarn && \
  echo -e 'export PATH="$PATH:$(yarn global bin)"' >> /etc/bash.bashrc && \
  # add pnpm
  yarn global add pnpm && \
  # link our bashrc
  rm /root/.bashrc && \
  ln -s /etc/bash.bashrc /root/.bashrc && \
  # smoke test
  node -v && \
  npm -v && \
  yarn -v && \
  pnpm -v && \
  # create directories
  mkdir -p /data && \
  # clean up build dependencies
  # clean up dependencies
  apt-get remove -y curl unzip gnupg2 &&  \
  # Add running dependencies
  apt-get install -y git procps && \
  apt-get autoremove -y && \
  rm -rf /var/lib/apt/lists/* && \
  # clean up tmp
  rm -rf /tmp/*

# Copy the supervisor
COPY ./supervisor /cli
COPY ./pnpm-lock.yaml /cli

# Link and install dependencies
WORKDIR /cli
RUN \
  NODE_ENV=production pnpm install -P --fix-lockfile && \
  pnpm store prune && \
  # https://github.com/pnpm/pnpm/issues/4761
  yarn link && \
  # smoke test
  docker-node-fnm-init --version

WORKDIR /data

# Create default configuration folders
RUN mkdir -p /scripts

# Copy scripts
ADD https://gist.githubusercontent.com/cenk1cenk2/e03d8610534a9c78f755c1c1ed93a293/raw/logger.sh /scripts/logger.sh
RUN chmod +x /scripts/*.sh && \
  chmod +x /etc/cont-init.d/*.sh

# s6 behaviour, https://github.com/just-containers/s6-overlay
ENV S6_KEEP_ENV 1
ENV S6_BEHAVIOUR_IF_STAGE2_FAILS 2
ENV S6_FIX_ATTRS_HIDDEN 1

ENTRYPOINT ["/init"]
