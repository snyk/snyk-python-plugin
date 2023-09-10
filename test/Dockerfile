ARG PYTHON_VERSION
FROM python:${PYTHON_VERSION}

RUN groupadd --gid 1000 appuser && \
    useradd --uid 1000 --gid appuser --shell /bin/bash --create-home appuser && \
    apt-get update && \
    apt-get -y install npm pipenv && \
    rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://fnm.vercel.app/install | bash -s -- --install-dir "/opt/fnm" --skip-shell && \
    ln -s /opt/fnm/fnm /usr/bin/ &&  \
    chmod +x /usr/bin/fnm

ARG PIP_VERSION
ENV PIP_VERSION $PIP_VERSION

ARG NODE_VERSION
ENV NODE_VERSION $NODE_VERSION

WORKDIR /home/appuser/app

RUN eval "$(fnm env)" && \
    fnm install ${NODE_VERSION} && \
    fnm use ${NODE_VERSION} && \
    fnm alias default ${NODE_VERSION}

COPY --chown=appuser:appuser . ./

RUN npm install

USER appuser
ENV PATH="/home/appuser/.local/bin:${PATH}"

RUN python -m pip install --user --quiet -r dev-requirements.txt --disable-pip-version-check && \
    python -m pip install --user --quiet pip==${PIP_VERSION}

CMD ["npm", "run", "test"]
