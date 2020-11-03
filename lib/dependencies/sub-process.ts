import { spawn, spawnSync, SpawnOptions } from 'child_process';

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

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn(command, args, spawnOptions);
    proc.stdout.on('data', (data) => {
      console.log('stdout', { data });
      stdout = stdout + data;
    });
    proc.stderr.on('data', (data) => {
      console.log('stderr', { data });
      stderr = stderr + data;
    });

    proc.on('close', (code) => {
      console.log('close', { code });
      if (code !== 0) {
        return reject(stdout || stderr);
      }
      resolve(stdout || stderr);
    });
    proc.on('end', (code) => {
      console.log('end', { code });
      resolve(stdout || stderr);
    });
    proc.on('error', (code) => {
      console.log('This is error capture', { code });
      return reject(stdout || stderr);
    });
  });
}

export function executeSync(
  command: string,
  args: string[],
  options?: SpawnOptions
) {
  const spawnOptions = makeSpawnOptions(options);

  return spawnSync(command, args, spawnOptions);
}
