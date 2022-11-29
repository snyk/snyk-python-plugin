import { spawn, spawnSync, SpawnOptions } from 'child_process';
import { quoteAll } from 'shescape';

interface ProcessOptions {
  cwd?: string;
  env?: { [name: string]: string };
}

function makeSpawnOptions(options?: ProcessOptions) {
  const spawnOptions: SpawnOptions = { shell: true };
  if (options && options.cwd) {
    spawnOptions.cwd = options.cwd;
  }
  if (options && options.env) {
    spawnOptions.env = options.env;
  }
  return spawnOptions;
}

export function execute(
  command: string,
  args: string[],
  options?: ProcessOptions
): Promise<string> {
  const spawnOptions = makeSpawnOptions(options);
  args = quoteAll(args, spawnOptions);
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn(command, args, spawnOptions);
    proc.stdout.on('data', (data) => {
      stdout = stdout + data;
    });
    proc.stderr.on('data', (data) => {
      stderr = stderr + data;
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
  args = quoteAll(args, spawnOptions);

  return spawnSync(command, args, spawnOptions);
}
