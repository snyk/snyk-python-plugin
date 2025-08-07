import { spawn, SpawnOptions, spawnSync } from 'child_process';
import { escapeAll, quoteAll } from 'shescape/stateless';
import * as os from 'node:os';

interface ProcessOptions {
  cwd?: string;
  env?: { [name: string]: string };
}

function processArguments(
  args: string[],
  spawnOptions: SpawnOptions
): string[] {
  if (!args) {
    return args;
  }

  // Best practices, also security-wise, is to not invoke processes in a shell, but as a stand-alone command.
  // However, on Windows, we need to invoke the command in a shell, due to internal NodeJS problems with this approach
  // see: https://nodejs.org/docs/latest-v24.x/api/child_process.html#spawning-bat-and-cmd-files-on-windows
  const isWinLocal = /^win/.test(os.platform());
  if (isWinLocal) {
    spawnOptions.shell = true;
    // Further, we distinguish between quoting and escaping arguments since quoteAll does not support quoting without
    // supplying a shell, but escapeAll does.
    // See this (very long) discussion for more details: https://github.com/ericcornelissen/shescape/issues/2009
    return quoteAll(args, { ...spawnOptions, flagProtection: false });
  } else {
    return escapeAll(args, { ...spawnOptions, flagProtection: false });
  }
}

function makeSpawnOptions(options?: ProcessOptions): SpawnOptions {
  const spawnOptions: SpawnOptions = {
    shell: false,
    env: { ...process.env },
  };

  if (options && options.cwd) {
    spawnOptions.cwd = options.cwd;
  }
  if (options && options.env) {
    spawnOptions.env = { ...options.env };
  }

  // Before spawning an external process, we look if we need to restore the system proxy configuration,
  // which overrides the cli internal proxy configuration.
  if (process.env.SNYK_SYSTEM_HTTP_PROXY !== undefined) {
    spawnOptions.env.HTTP_PROXY = process.env.SNYK_SYSTEM_HTTP_PROXY;
  }
  if (process.env.SNYK_SYSTEM_HTTPS_PROXY !== undefined) {
    spawnOptions.env.HTTPS_PROXY = process.env.SNYK_SYSTEM_HTTPS_PROXY;
  }
  if (process.env.SNYK_SYSTEM_NO_PROXY !== undefined) {
    spawnOptions.env.NO_PROXY = process.env.SNYK_SYSTEM_NO_PROXY;
  }

  return spawnOptions;
}

export function execute(
  command: string,
  args: string[],
  options?: ProcessOptions
): Promise<string> {
  const spawnOptions = makeSpawnOptions(options);
  const processedArgs = processArguments(args, spawnOptions);

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn(command, processedArgs, spawnOptions);
    proc.stdout.on('data', (data) => {
      stdout = stdout + data;
    });

    proc.stderr.on('data', (data) => {
      stderr = stderr + data;
    });

    proc.on('error', (err) => {
      stderr = err.message;
      return reject({ stdout, stderr });
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(stdout || stderr);
      }
      resolve(stdout || stderr);
    });
  });
}

export function executeSync(
  command: string,
  args: string[],
  options?: ProcessOptions
) {
  const spawnOptions = makeSpawnOptions(options);
  const processedArgs = processArguments(args, spawnOptions);

  return spawnSync(command, processedArgs, spawnOptions);
}
