{
  "name": "snyk-python-plugin",
  "description": "Snyk CLI Python plugin",
  "homepage": "https://github.com/snyk/snyk-python-plugin",
  "repository": {
    "type": "git",
    "url": "https://github.com/snyk/snyk-python-plugin"
  },
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "watch": "tsc -w",
    "build-tests": "tsc -p tsconfig-test.json",
    "format:check": "prettier --check '{lib,test}/**/*.{js,ts}'",
    "format": "prettier --write '{lib,test}/**/*.{js,ts}'",
    "prepare": "npm run build",
    "test": "npm run test:pysrc && npm run test:tap && npm run test:jest",
    "test:tap": "cross-env TS_NODE_PROJECT=tsconfig-test.json tap --node-arg=-r --node-arg=ts-node/register ./test/**/*.test.{js,ts} -R spec --timeout=900",
    "test:jest": "jest",
    "test:pysrc": "python -m unittest discover pysrc",
    "lint": "npm run build-tests && npm run format:check && eslint --cache '{lib,test}/**/*.{js,ts}'"
  },
  "author": "snyk.io",
  "license": "Apache-2.0",
  "dependencies": {
    "@snyk/cli-interface": "^2.11.2",
    "@snyk/dep-graph": "^1.28.1",
    "shescape": "1.6.1",
    "snyk-poetry-lockfile-parser": "^1.1.7",
    "tmp": "0.2.1"
  },
  "devDependencies": {
    "@snyk/types-tap": "^1.1.0",
    "@types/jest": "^28.1.3",
    "@types/node": "^16.11.66",
    "@types/tmp": "^0.1.0",
    "@typescript-eslint/eslint-plugin": "^4.33.0",
    "@typescript-eslint/parser": "^4.33.0",
    "cross-env": "^5.2.0",
    "eslint": "^7.32.0",
    "eslint-config-prettier": "^8.3.0",
    "jest": "^28.1.3",
    "jest-diff": "^25.5.0",
    "jest-junit": "^10.0.0",
    "prettier": "^2.7.1",
    "sinon": "^2.3.2",
    "tap": "^12.6.1",
    "ts-jest": "^28.0.8",
    "ts-node": "^8.10.2",
    "typescript": "^4.8.4"
  }
}
