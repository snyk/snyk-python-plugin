var path = require('path');
var subProcess = require('./sub-process');
var fs = require('fs');
var tmp = require('tmp');

module.exports = {
  inspect: inspect,
};

module.exports.__tests = {
  buildArgs: buildArgs,
};

function inspect(root, targetFile, options) {
  if (!options) {
    options = {};
  }
  var command = options.command || 'python';
  var includeDevDeps = !!(options.dev || false);
  var baseargs = [];

  if (path.basename(targetFile) === 'Pipfile') {
    // Check that pipenv is available by running it.
    var pipenvCheckProc = subProcess.executeSync('pipenv', ['--version']);
    if (pipenvCheckProc.status !== 0) {
      throw new Error(
        'Failed to run `pipenv`; please make sure it is installed.');
    }
    command = 'pipenv';
    baseargs = ['run', 'python'];
  }

  return Promise.all([
    getMetaData(command, baseargs, root, targetFile),
    getDependencies(
      command,
      baseargs,
      root,
      targetFile,
      options.allowMissing,
      includeDevDeps,
      options.args
    ),
  ])
    .then(function (result) {
      return {
        plugin: result[0],
        package: result[1],
      };
    });
}

function getMetaData(command, baseargs, root, targetFile) {
  return subProcess.execute(
    command,
    [].concat(baseargs, ['--version']),
    {cwd: root}
  )
    .then(function (output) {
      return {
        name: 'snyk-python-plugin',
        runtime: output.replace('\n', ''),
        // specify targetFile only in case of Pipfile
        targetFile:
          (path.basename(targetFile) === 'Pipfile') ? targetFile : undefined,
      };
    });
}

// Hack:
// We're using Zeit assets feature in order to support Python and Go testing
// within a binary release. By doing "path.join(__dirname, 'PATH'), Zeit adds
// PATH file auto to the assets. Sadly, Zeit doesn't support (as far as I
// understand) adding a full folder as an asset, and this is why we're adding
// the required files this way. In addition, Zeit doesn't support
// path.resolve(), and this is why I'm using path.join()
function createAssets(){
  var assets = [];
  assets.push(path.join(__dirname, '../plug/pip_resolve.py'));
  assets.push(path.join(__dirname, '../plug/distPackage.py'));
  assets.push(path.join(__dirname, '../plug/package.py'));
  assets.push(path.join(__dirname, '../plug/pipfile.py'));
  assets.push(path.join(__dirname, '../plug/reqPackage.py'));
  assets.push(path.join(__dirname, '../plug/utils.py'));

  assets.push(path.join(__dirname, '../plug/requirements/fragment.py'));
  assets.push(path.join(__dirname, '../plug/requirements/parser.py'));
  assets.push(path.join(__dirname, '../plug/requirements/requirement.py'));
  assets.push(path.join(__dirname, '../plug/requirements/vcs.py'));
  assets.push(path.join(__dirname, '../plug/requirements/__init__.py'));

  assets.push(path.join(__dirname, '../plug/pytoml/__init__.py'));
  assets.push(path.join(__dirname, '../plug/pytoml/core.py'));
  assets.push(path.join(__dirname, '../plug/pytoml/parser.py'));
  assets.push(path.join(__dirname, '../plug/pytoml/writer.py'));

  return assets;
}

function writeFile(writeFilePath, contents) {
  var dirPath = path.dirname(writeFilePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath);
  }
  fs.writeFileSync(writeFilePath, contents);
}

function getFilePathRelativeToDumpDir(filePath) {
  var pathParts = filePath.split('\\plug\\');

  // Windows
  if (pathParts.length > 1) {
    return pathParts[1];
  }

  // Unix
  pathParts = filePath.split('/plug/');
  return pathParts[1];
}

function dumpAllFilesInTempDir(tempDirName) {
  createAssets().forEach(function(currentReadFilePath) {
    if (!fs.existsSync(currentReadFilePath)) {
      throw new Error('The file `' + currentReadFilePath + '` is missing');
    }

    var relFilePathToDumpDir =
      getFilePathRelativeToDumpDir(currentReadFilePath);

    var writeFilePath = path.join(tempDirName, relFilePathToDumpDir);

    var contents = fs.readFileSync(currentReadFilePath);
    writeFile(writeFilePath, contents);
  });
}

function getDependencies(
  command,
  baseargs,
  root,
  targetFile,
  allowMissing,
  includeDevDeps,
  args
) {
  var tempDirObj = tmp.dirSync({
    unsafeCleanup: true,
  });

  dumpAllFilesInTempDir(tempDirObj.name);

  return subProcess.execute(
    command,
    [].concat(baseargs,
      buildArgs(
        targetFile,
        allowMissing,
        tempDirObj.name,
        includeDevDeps,
        args
      )
    ),
    {cwd: root}
  )
    .then(function (output) {
      tempDirObj.removeCallback();
      return JSON.parse(output);
    })
    .catch(function (error) {
      tempDirObj.removeCallback();
      if (typeof error === 'string') {
        if (error.indexOf('Required package missing') !== -1) {
          var errMsg = 'Please run `pip install -r ' + targetFile + '`';
          if (path.basename(targetFile) === 'Pipfile') {
            errMsg = 'Please run `pipenv update`';
          }
          throw new Error(errMsg);
        }
        throw new Error(error);
      }
      throw error;
    });
}

function buildArgs(
  targetFile,
  allowMissing,
  tempDirPath,
  includeDevDeps,
  extraArgs
) {
  var pathToRun = path.join(tempDirPath, 'pip_resolve.py');
  var args = [pathToRun];
  if (targetFile) {
    args.push(targetFile);
  }
  if (allowMissing) {
    args.push('--allow-missing');
  }
  if (includeDevDeps) {
    args.push('--dev-deps');
  }
  if (extraArgs) {
    args = args.concat(extraArgs);
  }
  return args;
}
