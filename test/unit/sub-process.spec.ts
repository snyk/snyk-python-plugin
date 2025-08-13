import { executeSync, execute } from '../../lib/dependencies/sub-process';

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

  describe('Security: Command injection protection', () => {
    it('should prevent command injection in executeSync()', () => {
      // Test that malicious command strings are treated as literal filenames (not executed)
      const maliciousCommand = 'python3; echo injected';
      const result = executeSync(maliciousCommand, ['--version']);

      // Should fail with ENOENT because 'python3; echo injected' is not a valid executable
      expect(result.status).not.toBe(0);
      expect((result.error as any)?.code).toBe('ENOENT');
    });

    it('should prevent command injection in execute()', async () => {
      // Test that malicious command strings are treated as literal filenames (not executed)
      const maliciousCommand = 'python3; whoami; echo injected';

      try {
        await execute(maliciousCommand, ['--version']);
        fail('Expected execute() to reject with an error');
      } catch (error: any) {
        // Should fail with ENOENT because the malicious command is treated as a literal filename
        expect(error.code).toBe('ENOENT');
        expect(error.syscall).toBe(`spawn ${maliciousCommand}`);
      }
    });

    it('should execute legitimate commands normally', async () => {
      // Verify that normal commands still work correctly
      const result = await execute('python3', ['--version']);
      expect(result).toMatch(/Python \d+\.\d+\.\d+/);
    });

    it('should handle arguments with special characters safely', async () => {
      // Verify that special characters in arguments don't enable injection
      const result = await execute('python3', ['--version', '; echo injected']);
      // Should only show Python version, not execute the injected command
      expect(result).toMatch(/Python \d+\.\d+\.\d+/);
      expect(result).not.toMatch(/injected/);
    });
  });
});
