import * as path from 'path';
import { execute, executeSync } from '../../lib/dependencies/sub-process';

const PRINT_ENV = path.join(__dirname, '..', 'fixtures', 'print-env.js');

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

describe('child process environment', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it("execute(): the child gets no SNYK_* variables and the user's HTTP_PROXY", async () => {
    process.env = {
      ...originalEnv,
      SNYK_TOKEN: 'test-token',
      snyk_lowercase: 'test-value',
      HTTP_PROXY: 'http://internal:1',
      SNYK_SYSTEM_HTTP_PROXY: 'http://corp:3128',
    };

    const child = JSON.parse(await execute('node', [PRINT_ENV]));

    expect(child.snykKeys).toEqual([]);
    expect(child.HTTP_PROXY).toBe('http://corp:3128');
  });

  it("executeSync(): the child gets no SNYK_* variables and the user's HTTP_PROXY", () => {
    process.env = {
      ...originalEnv,
      SNYK_TOKEN: 'test-token',
      snyk_lowercase: 'test-value',
      HTTP_PROXY: 'http://internal:1',
      SNYK_SYSTEM_HTTP_PROXY: 'http://corp:3128',
    };

    const child = JSON.parse(
      executeSync('node', [PRINT_ENV]).stdout.toString()
    );

    expect(child.snykKeys).toEqual([]);
    expect(child.HTTP_PROXY).toBe('http://corp:3128');
  });
});
