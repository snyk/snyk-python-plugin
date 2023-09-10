ARG PYTHON_VERSION
FROM python:${PYTHON_VERSION}

ARG PIP_VERSION
ENV PIP_VERSION $PIP_VERSION
ARG NODE_VERSION
ENV NODE_VERSION $NODE_VERSION

RUN apt-get update && \
    apt-get -y install npm pipenv && \
    rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://fnm.vercel.app/install | bash -s -- --install-dir "/opt/fnm" --skip-shell && \
    ln -s /opt/fnm/fnm /usr/bin/ &&  \
    chmod +x /usr/bin/fnm
RUN eval "$(fnm env)" && \
    fnm install ${NODE_VERSION} && \
    fnm use ${NODE_VERSION} && \
    fnm alias default ${NODE_VERSION}

WORKDIR /app

COPY . ./

RUN python -m pip install --user --quiet -r dev-requirements.txt --disable-pip-version-check && \
    python -m pip install --user --quiet pip==${PIP_VERSION}

RUN --mount=type=secret,id=npm_token,uid=1000,required=true \
    echo "//registry.npmjs.org/:_authToken=$(cat /run/secrets/npm_token)" > ~/.npmrc && \
    npm i && \
    rm ~/.npmrc

RUN npm run build

CMD ["npm", "run", "test"]
