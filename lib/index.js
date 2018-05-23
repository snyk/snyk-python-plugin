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
  if (!options) { options = {}; }
  var command = options.command || 'python';
  return Promise.all([
    getMetaData(command, root),
    getDependencies(
      command, root, targetFile, options.allowMissing, options.args),
  ])
  .then(function (result) {
    return {
      plugin: result[0],
      package: result[1],
    };
  });
}

function getMetaData(command, root) {
  return subProcess.execute(command, ['--version'], { cwd: root })
  .then(function (output) {
    return {
      name: 'snyk-python-plugin',
      runtime: output.replace('\n', ''),
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
  assets = [];
  assets.push(path.join(__dirname, '../plug/pip_resolve.py'));
  assets.push(path.join(__dirname, '../plug/distPackage.py'));
  assets.push(path.join(__dirname, '../plug/package.py'));
  assets.push(path.join(__dirname, '../plug/reqPackage.py'));
  assets.push(path.join(__dirname, '../plug/utils.py'));

  assets.push(path.join(__dirname, '../plug/requirements/fragment.py'));
  assets.push(path.join(__dirname, '../plug/requirements/parser.py'));
  assets.push(path.join(__dirname, '../plug/requirements/requirement.py'));
  assets.push(path.join(__dirname, '../plug/requirements/vcs.py'));
  assets.push(path.join(__dirname, '../plug/requirements/__init__.py'));

  return assets;
}

function writeFile(writeFilePath, contents) {
  var dirPath = path.dirname(writeFilePath);
  if (!fs.existsSync(dirPath))
  {
    fs.mkdirSync(dirPath);
  }
  fs.writeFileSync(writeFilePath, contents);
}

function getFilePathRelativeToDumpDir(filePath) {
  var pathParts = filePath.split('\\plug\\');

  // Windows
  if (pathParts.length > 1)
  {
    return pathParts[1];
  }

  // Unix
  pathParts = filePath.split('/plug/');
  return pathParts[1];  
}

function dumpAllFilesInTempDir(tempDirName) {
  createAssets().forEach(function(currentReadFilePath) {
    if (!fs.existsSync(currentReadFilePath))
    {
      throw new Error('The file `' + currentReadFilePath + '` is missing');
    }
    
    var relFilePathToDumpDir = 
      getFilePathRelativeToDumpDir(currentReadFilePath);
    
    var writeFilePath = path.join(tempDirName, relFilePathToDumpDir);

    var contents = fs.readFileSync(currentReadFilePath);
    writeFile(writeFilePath, contents);
  });
}

function getDependencies(command, root, targetFile, allowMissing, args) {  
  var tempDirObj = tmp.dirSync({
    unsafeCleanup: true
  });

  dumpAllFilesInTempDir(tempDirObj.name);

  return subProcess.execute(
    command,
    buildArgs(targetFile, allowMissing, tempDirObj.name, args),
    { cwd: root }
  )
  .then(function (output) {
    tempDirObj.removeCallback();
    return JSON.parse(output);
  })
  .catch(function (error) {
    tempDirObj.removeCallback();
    if (typeof error === 'string') {
      if (error.indexOf('Required package missing') !== -1) {
        // TODO: this should be checked in the CLI, not here
        throw new Error('Please run `pip install -r ' + targetFile + '`');
      }
      throw new Error(error);
    }
    throw error;
  });
}

function buildArgs(targetFile, allowMissing, tempDirPath, extraArgs) {

  var pathToRun = path.join(tempDirPath, 'pip_resolve.py');
  var args = [pathToRun];
  if (targetFile) { args.push(targetFile); }
  if (allowMissing) { args.push('--allow-missing'); }
  if (extraArgs) { args = args.concat(extraArgs); }
  return args;
}