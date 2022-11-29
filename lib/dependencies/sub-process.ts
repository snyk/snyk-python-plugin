import { spawn, spawnSync, SpawnOptions } from 'child_process';

interface ProcessOptions {
  cwd?: string;
  env?: { [name: string]: string };
  shell?: boolean;
}

function makeSpawnOptions(options?: ProcessOptions) {
  const spawnOptions: SpawnOptions = {};
  if (options?.shell) {
    spawnOptions.shell = true;
  }
  if (options?.cwd) {
    spawnOptions.cwd = options.cwd;
  }
  if (options?.env) {
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

  return spawnSync(command, args, spawnOptions);
}
