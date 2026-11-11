import * as childProcess from 'child_process';
import * as path from 'path';
import { execute, executeSync } from '../../lib/dependencies/sub-process';

const PRINT_ENV_FIXTURE = path.join(
  __dirname,
  '..',
  'fixtures',
  'print-env.js'
);

const TEST_ENV: Record<string, string> = {
  SNYK_TOKEN: 'test-token',
  SNYK_OAUTH_TOKEN: 'test-oauth-token',
  snyk_cfg_api: 'test-cfg-api',
  HTTP_PROXY: 'http://internal:1',
  SNYK_SYSTEM_HTTP_PROXY: 'http://corp:3128',
  UNRELATED_VAR: 'keep',
};
const isSnykKey = (key: string) => /^snyk_/i.test(key);
const hasPath = (keys: string[]) =>
  keys.some((key) => key.toUpperCase() === 'PATH');

describe('child process environment', () => {
  let savedEnv: Map<string, string | undefined>;

  beforeEach(() => {
    savedEnv = new Map();
    for (const key of Object.keys(TEST_ENV)) {
      savedEnv.set(key, process.env[key]);
    }
    Object.assign(process.env, TEST_ENV);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    for (const [key, value] of savedEnv) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('passes spawn an env without SNYK_* variables and with the user proxy', async () => {
    const spy = jest.spyOn(childProcess, 'spawn');
    await execute(process.execPath, [PRINT_ENV_FIXTURE]);
    const env = spy.mock.calls[0][2]?.env;
    expect(env).toBeDefined();
    expect(Object.keys(env!).filter(isSnykKey)).toEqual([]);
    expect(env!.HTTP_PROXY).toBe('http://corp:3128');
    expect(env!.http_proxy).toBe('http://corp:3128');
    expect(env!.UNRELATED_VAR).toBe('keep');
    expect(hasPath(Object.keys(env!))).toBe(true);
  });

  it('passes spawnSync an env without SNYK_* variables and with the user proxy', () => {
    const spy = jest.spyOn(childProcess, 'spawnSync');
    executeSync(process.execPath, [PRINT_ENV_FIXTURE]);
    const env = spy.mock.calls[0][2]?.env;
    expect(env).toBeDefined();
    expect(Object.keys(env!).filter(isSnykKey)).toEqual([]);
    expect(env!.HTTP_PROXY).toBe('http://corp:3128');
    expect(env!.http_proxy).toBe('http://corp:3128');
    expect(env!.UNRELATED_VAR).toBe('keep');
    expect(hasPath(Object.keys(env!))).toBe(true);
  });

  it('the child process sees no SNYK_* variables and gets the user proxy', async () => {
    const child = JSON.parse(
      await execute(process.execPath, [PRINT_ENV_FIXTURE])
    );
    expect(child.keys.filter(isSnykKey)).toEqual([]);
    expect(child.HTTP_PROXY).toBe('http://corp:3128');
    expect(child.http_proxy).toBe('http://corp:3128');
    expect(child.UNRELATED_VAR).toBe('keep');
    expect(hasPath(child.keys)).toBe(true);
  });

  it('does not modify process.env', async () => {
    await execute(process.execPath, [PRINT_ENV_FIXTURE]);
    expect(process.env.SNYK_TOKEN).toBe('test-token');
    expect(process.env.HTTP_PROXY).toBe('http://internal:1');
  });

  it('cleans an env passed by the caller', async () => {
    const child = JSON.parse(
      await execute(process.execPath, [PRINT_ENV_FIXTURE], {
        env: { ...process.env, SNYK_EXTRA: 'x' } as Record<string, string>,
      })
    );
    expect(child.keys.filter(isSnykKey)).toEqual([]);
    expect(child.http_proxy).toBe('http://corp:3128');
  });
});

describe('Test sub-process.ts', () => {
  it('test restoring proxy setting in executeSync()', async () => {
    const expectedProxy = 'proxy';
    const expectedProxyHTTPS = 'proxy2';
    const expectedNoProxy = 'no-proxy';

    process.env.SNYK_SYSTEM_HTTP_PROXY = 'http://127.0.0.1:3128';
    process.env.SNYK_SYSTEM_HTTPS_PROXY = 'http://127.0.0.1:3129';
    process.env.SNYK_SYSTEM_NO_PROXY = 'something.com';

    const options = {
      env: {
        HTTP_PROXY: expectedProxy,
        HTTPS_PROXY: expectedProxyHTTPS,
        NO_PROXY: expectedNoProxy,
      },
    };

    let output = executeSync(
      'python3',
      ['-c', "import os; print(os.environ['HTTP_PROXY'])"],
      options
    );
    expect(output.stdout.toString().trim()).toEqual(
      process.env.SNYK_SYSTEM_HTTP_PROXY
    );

    output = executeSync(
      'python3',
      ['-c', "import os; print(os.environ['HTTPS_PROXY'])"],
      options
    );
    expect(output.stdout.toString().trim()).toEqual(
      process.env.SNYK_SYSTEM_HTTPS_PROXY
    );

    output = executeSync(
      'python3',
      ['-c', "import os; print(os.environ['NO_PROXY'])"],
      options
    );
    expect(output.stdout.toString().trim()).toEqual(
      process.env.SNYK_SYSTEM_NO_PROXY
    );

    // ensure that options remain unchanged
    expect(options.env.HTTP_PROXY).toEqual(expectedProxy);
    expect(options.env.HTTPS_PROXY).toEqual(expectedProxyHTTPS);
    expect(options.env.NO_PROXY).toEqual(expectedNoProxy);

    delete process.env.SNYK_SYSTEM_HTTP_PROXY;
    delete process.env.SNYK_SYSTEM_HTTPS_PROXY;
    delete process.env.SNYK_SYSTEM_NO_PROXY;
  });

  it('test executeSync()', async () => {
    const expectedProxy = 'proxy';
    const expectedProxyHTTPS = 'proxy2';
    const expectedNoProxy = 'no-proxy';

    const options = {
      env: {
        HTTP_PROXY: expectedProxy,
        HTTPS_PROXY: expectedProxyHTTPS,
        NO_PROXY: expectedNoProxy,
      },
    };

    let output = executeSync(
      'python3',
      ['-c', "import os; print(os.environ['HTTP_PROXY'])"],
      options
    );
    expect(output.stdout.toString().trim()).toEqual(expectedProxy);

    output = executeSync(
      'python3',
      ['-c', "import os; print(os.environ['HTTPS_PROXY'])"],
      options
    );
    expect(output.stdout.toString().trim()).toEqual(expectedProxyHTTPS);

    output = executeSync(
      'python3',
      ['-c', "import os; print(os.environ['NO_PROXY'])"],
      options
    );
    expect(output.stdout.toString().trim()).toEqual(expectedNoProxy);
  });
});
