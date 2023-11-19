# syntax=docker/dockerfile-upstream:master-labs
FROM cenk1cenk2/vizier:latest AS vizier

FROM debian:bullseye-slim

# Workdir for node package

ENV FNM_VERSION 1.35.1
ENV FNM_DIR /opt/fnm
ENV FNM_INTERACTIVE_CLI false
ENV FNM_INSTALL_VERSION 20

WORKDIR /tmp

COPY ./rootfs /

COPY --from=vizier /usr/bin/vizier /usr/bin/vizier

SHELL [ "bash", "-c" ]

# Install fnm and initiate it
RUN \
  apt-get update && \
  apt-get install -y curl unzip gnupg2 tini && \
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
  echo "deb [trusted=yes] https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
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
  yarn link

RUN \
  # smoke test
  docker-node-fnm-init --version && \
  vizier --version

WORKDIR /data

ENTRYPOINT ["tini", "/entrypoint.sh"]
