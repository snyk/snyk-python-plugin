/* eslint-disable no-console, @typescript-eslint/no-non-null-assertion */
import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';
import subProcess = require('../lib/dependencies/sub-process');

export {
  getActiveVenvName,
  activateVirtualenv,
  deactivateVirtualenv,
  ensureVirtualenv,
  pipInstall,
  pipenvInstall,
  pipUninstall,
  setupPyInstall,
};

const binDirName = process.platform === 'win32' ? 'Scripts' : 'bin';

function getActiveVenvName() {
  return process.env.VIRTUAL_ENV
    ? path.basename(process.env.VIRTUAL_ENV)
    : null;
}

function activateVirtualenv(venvName: string) {
  const venvDir = path.join(path.resolve(__dirname), '.venvs', venvName);

  const binDir = path.resolve(venvDir, binDirName);

  const origProcessEnv = Object.assign({}, process.env);

  if (process.env.VIRTUAL_ENV) {
    const pathElements = process.env.PATH!.split(path.delimiter);
    const index = pathElements.indexOf(process.env.VIRTUAL_ENV);
    if (index > -1) {
      pathElements.splice(index, 1);
    }
    process.env.PATH = pathElements.join(path.delimiter);
  }

  // simulate the "activate" virtualenv script
  process.env.PATH = binDir + path.delimiter + process.env.PATH;
  process.env.VIRTUAL_ENV = venvDir;
  delete process.env.PYTHONHOME;

  return function revert() {
    process.env.VIRTUAL_ENV = origProcessEnv.VIRTUAL_ENV;
    process.env.PATH = origProcessEnv.PATH;
    process.env.PYTHONHOME = origProcessEnv.PYTHONHOME;
  };
}

function deactivateVirtualenv() {
  if (getActiveVenvName() === null) {
    console.warn('Attempted to deactivate a virtualenv when none was active.');
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return () => {};
  }

  const origProcessEnv = Object.assign({}, process.env);

  // simulate the "deactivate" virtualenv script
  const pathElements = process.env.PATH!.split(path.delimiter);
  const venvBinDir = path.join(process.env.VIRTUAL_ENV!, binDirName);
  const index = pathElements.indexOf(venvBinDir);
  if (index > -1) {
    pathElements.splice(index, 1);
  }
  process.env.PATH = pathElements.join(path.delimiter);
  delete process.env.VIRTUAL_ENV;
  delete process.env.PYTHONHOME;

  return function revert() {
    process.env.VIRTUAL_ENV = origProcessEnv.VIRTUAL_ENV;
    process.env.PATH = origProcessEnv.PATH;
    process.env.PYTHONHOME = origProcessEnv.PYTHONHOME;
  };
}

function ensureVirtualenv(venvName: string) {
  const venvsBaseDir = path.join(path.resolve(__dirname), '.venvs');
  try {
    fs.accessSync(venvsBaseDir, fs.constants.R_OK);
  } catch (e) {
    fs.mkdirSync(venvsBaseDir);
  }

  const venvDir = path.join(venvsBaseDir, venvName);
  try {
    fs.accessSync(venvDir, fs.constants.R_OK);
    return false;
  } catch (e) {
    createVenv(venvDir);
    return true;
  }
}

function createVenv(venvDir: string) {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  let revert = () => {};
  if (process.env.VIRTUAL_ENV) {
    revert = deactivateVirtualenv();
  }
  try {
    let proc = subProcess.executeSync('python3 -m venv', [venvDir]);
    if (proc.status !== 0) {
      console.error(proc.stdout.toString() + '\n' + proc.stderr.toString());
      throw new Error('Failed to create virtualenv in ' + venvDir);
    }
    if (process.env.PIP_VER) {
      proc = subProcess.executeSync(
        path.resolve(venvDir, binDirName, 'python3'),
        ['-m', 'pip', 'install', `pip==${process.env.PIP_VER}`]
      );
      if (proc.status !== 0) {
        console.error(proc.stdout.toString() + '\n' + proc.stderr.toString());
        throw new Error(
          'Failed to install required pip version in virtualenv ' + venvDir
        );
      }
    }
  } finally {
    revert();
  }
}

function pipInstall() {
  const proc = subProcess.executeSync('pip', [
    'install',
    '-r',
    'requirements.txt',
    '--disable-pip-version-check',
  ]);
  if (proc.status !== 0) {
    console.log('' + proc.stderr);
    throw new Error(
      'Failed to install requirements with pip.' +
        ' venv = ' +
        JSON.stringify(getActiveVenvName())
    );
  }
}

function pipenvInstall() {
  updateSetuptools();
  const proc = subProcess.executeSync('pipenv', ['install']);

  if (proc.status !== 0) {
    console.log('' + proc.stderr);
    throw new Error(
      'Failed to install requirements with pipenv.' +
        ' venv = ' +
        JSON.stringify(getActiveVenvName())
    );
  }
}

function updateSetuptools() {
  const proc = subProcess.executeSync('python3', [
    '-m',
    'pip',
    'install',
    '--upgrade',
    'setuptools',
  ]);
  if (proc.status !== 0) {
    console.log('' + proc.stderr);
    throw new Error(
      'Failed to update setuptools.' +
        ' venv = ' +
        JSON.stringify(getActiveVenvName())
    );
  }
}

function setupPyInstall() {
  updateSetuptools();
  const proc = subProcess.executeSync('pip', ['install', '-e', '.']);
  if (proc.status !== 0) {
    console.log('' + proc.stderr);
    throw new Error(
      'Failed to install requirements with setup.py.' +
        ' venv = ' +
        JSON.stringify(getActiveVenvName())
    );
  }
}

function pipUninstall(pkgName: string) {
  const proc = subProcess.executeSync('pip', ['uninstall', '-y', pkgName]);
  if (proc.status !== 0) {
    throw new Error(
      'Failed to uninstall "' +
        pkgName +
        '" with pip.' +
        ' venv = ' +
        JSON.stringify(getActiveVenvName())
    );
  }
}

export function chdirWorkspaces(dir: string) {
  process.chdir(path.resolve(__dirname, 'workspaces', dir));
}
