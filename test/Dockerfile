ARG PIP_VERSION
ARG NODE_VERSION
ARG PYTHON_VERSION
FROM python:${PYTHON_VERSION}

RUN apt-get update && \
    apt-get install pipenv && \
    rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://fnm.vercel.app/install | bash && \
    fnm use ${NODE_VERSION}

WORKDIR /app

COPY . ./

RUN python -m pip install --user --quiet -r dev-requirements.txt --disable-pip-version-check && \
    python -m pip install --user --quiet pip==${PIP_VERSION}

RUN --mount=type=secret,id=npm_token,uid=1000,required=true \
    echo "//registry.npmjs.org/:_authToken=$(cat /run/secrets/npm_token)" > ~/.npmrc && \
    npm clean-install && \
    rm ~/.npmrc

RUN npm run build

CMD ["npm", "run", "test"]
