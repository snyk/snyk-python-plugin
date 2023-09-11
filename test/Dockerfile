ARG NODE_VERSION
FROM node:${NODE_VERSION}

ARG DEVUSER=node
USER ${DEVUSER}

SHELL ["/bin/bash", "-c"]

WORKDIR /home/${DEVUSER}

ARG PYTHON_VERSION
ENV PYTHON_VERSION $PYTHON_VERSION

RUN set -ex \
    && curl -L https://github.com/pyenv/pyenv-installer/raw/master/bin/pyenv-installer | bash \
    && export PATH="$HOME/.pyenv/bin:$PATH" \
    && pyenv update \
    && pyenv install $PYTHON_VERSION \
    && pyenv global $PYTHON_VERSION \
    && pyenv rehash

ENV PATH="/home/${DEVUSER}/.pyenv/shims:${PATH}"
RUN python --version

COPY --chown=${DEVUSER}:${DEVUSER} . ./

RUN npm install

ENV PATH="/home/${DEVUSER}/.local/bin:${PATH}"
RUN python -m pip install --user --quiet -r dev-requirements.txt --disable-pip-version-check

CMD ["npm", "run", "test", "--", "--runInBand"]
