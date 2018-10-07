var fs = require('fs');
var path = require('path');
var process = require('process');

var subProcess = require('../lib/sub-process');


module.exports = {
  getActiveVenvName,
  activateVirtualenv,
  deactivateVirtualenv,
  ensureVirtualenv,
  pipInstall,
  pipUninstall,
  pipenvInstall,
  setWorkonHome,
};

function getActiveVenvName() {
  return process.env.VIRTUAL_ENV
    ? path.basename(process.env.VIRTUAL_ENV)
    : null;
}

function activateVirtualenv(venvName) {
  var venvDir = path.join(path.resolve(__dirname), '.venvs', venvName);

  var binDirName = process.platform === 'win32' ? 'Scripts' : 'bin';
  var binDir = path.resolve(venvDir, binDirName);

  var origProcessEnv = Object.assign({}, process.env);

  if (process.env.VIRTUAL_ENV) {
    var pathElements = process.env.PATH.split(path.delimiter);
    var index = pathElements.indexOf(process.env.VIRTUAL_ENV);
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
    console.warn(
      'Attempted to deactivate a virtualenv when none was active.');
    return;
  }

  var origProcessEnv = Object.assign({}, process.env);

  // simulate the "deactivate" virtualenv script
  var pathElements = process.env.PATH.split(path.delimiter);
  var binDirName = process.platform === 'win32' ? 'Scripts' : 'bin';
  var venvBinDir = path.join(process.env.VIRTUAL_ENV, binDirName);
  var index = pathElements.indexOf(venvBinDir);
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

function ensureVirtualenv(venvName) {
  var binDirName = process.platform === 'win32' ? 'Scripts' : 'bin';

  var venvsBaseDir = path.join(path.resolve(__dirname), '.venvs');
  try {
    fs.accessSync(venvsBaseDir, fs.R_OK);
  } catch (e) {
    fs.mkdirSync(venvsBaseDir);
  }

  var venvDir = path.join(venvsBaseDir, venvName);
  try {
    fs.accessSync(venvDir, fs.R_OK);
  } catch (e) {
    var revert = function () {};
    if (process.env.VIRTUAL_ENV) {
      revert = deactivateVirtualenv();
    }
    try {
      var proc = subProcess.executeSync('virtualenv', [venvDir]);
      if (proc.status !== 0) {
        console.error(proc.stdout.toString() + '\n' + proc.stderr.toString());
        throw new Error('Failed to create virtualenv in ' + venvDir);
      }
      if (process.env.PIP_VER) {
        proc = subProcess.executeSync(
          path.resolve(venvDir, binDirName, 'python'),
          ['-m', 'pip', 'install', `pip==${process.env.PIP_VER}`]
        );
        if (proc.status !== 0) {
          console.error(proc.stdout.toString() + '\n' + proc.stderr.toString());
          throw new Error('Failed to install required pip version in virtualenv ' + venvDir);
        }
      }
    } finally {
      revert();
    }
    return true;
  }

  return false;
}

function pipInstall() {
  var proc = subProcess.executeSync('pip',
    ['install', '-r', 'requirements.txt', '--disable-pip-version-check']);
  if (proc.status !== 0) {
    throw new Error(
      'Failed to install requirements with pip.' +
      ' venv = ' + JSON.stringify(getActiveVenvName())
    );
  }
}

function pipUninstall(pkgName) {
  var proc = subProcess.executeSync('pip',
    ['uninstall', '-y', pkgName]);
  if (proc.status !== 0) {
    throw new Error(
      'Failed to uninstall "' + pkgName + '" with pip.' +
      ' venv = ' + JSON.stringify(getActiveVenvName())
    );
  }
}

function pipenvInstall() {
  subProcess.executeSync('pip', ['install', 'pipenv']);
  try {
    subProcess.executeSync('pipenv', ['update']);
  } finally {
    try {
      fs.unlinkSync('Pipfile.lock');
    }
    catch (e) {
      // will error if the file doesn't exist, which is fine
    }
  }
}

function setWorkonHome() {
  var venvsBaseDir = path.join(path.resolve(__dirname), '.venvs');
  try {
    fs.accessSync(venvsBaseDir, fs.R_OK);
  } catch (e) {
    fs.mkdirSync(venvsBaseDir);
  }

  var origWorkonHome = process.env.WORKON_HOME;
  process.env.WORKON_HOME = venvsBaseDir;

  return function revert() {
    process.env.WORKON_HOME = origWorkonHome;
  };
}
