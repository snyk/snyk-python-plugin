import { executeSync } from '../../lib/dependencies/sub-process';

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
