import * as path from 'path';
import * as subProcess from './sub-process';
import * as fs from 'fs';
import * as tmp from 'tmp';

// tslint:disable-next-line
export const __tests = {
  buildArgs,
};

export function inspect(root, targetFile, options) {
  if (!options) {
    options = {};
  }
  let command = options.command || 'python';
  const includeDevDeps = !!(options.dev || false);
  let baseargs: string[] = [];

  if (path.basename(targetFile) === 'Pipfile') {
    // Check that pipenv is available by running it.
    const pipenvCheckProc = subProcess.executeSync('pipenv', ['--version']);
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
      options.args,
    ),
  ])
    .then((result) => {
      return {
        plugin: result[0],
        package: result[1],
      };
    });
}

function getMetaData(command, baseargs, root, targetFile) {
  return subProcess.execute(
    command,
    [...baseargs, '--version'],
    {cwd: root},
  )
    .then((output) => {
      return {
        name: 'snyk-python-plugin',
        runtime: output.replace('\n', ''),
        // specify targetFile only in case of Pipfile
        targetFile:
          (path.basename(targetFile) === 'Pipfile') ? targetFile : undefined,
      };
    });
}

  // path.join calls have to be exactly in this format, needed by "pkg" to build a standalone Snyk CLI binary:
  // https://www.npmjs.com/package/pkg#detecting-assets-in-source-code
function createAssets() {
  return [
    path.join(__dirname, '../plug/pip_resolve.py'),
    path.join(__dirname, '../plug/distPackage.py'),
    path.join(__dirname, '../plug/package.py'),
    path.join(__dirname, '../plug/pipfile.py'),
    path.join(__dirname, '../plug/reqPackage.py'),
    path.join(__dirname, '../plug/utils.py'),

    path.join(__dirname, '../plug/requirements/fragment.py'),
    path.join(__dirname, '../plug/requirements/parser.py'),
    path.join(__dirname, '../plug/requirements/requirement.py'),
    path.join(__dirname, '../plug/requirements/vcs.py'),
    path.join(__dirname, '../plug/requirements/__init__.py'),

    path.join(__dirname, '../plug/pytoml/__init__.py'),
    path.join(__dirname, '../plug/pytoml/core.py'),
    path.join(__dirname, '../plug/pytoml/parser.py'),
    path.join(__dirname, '../plug/pytoml/writer.py'),
  ];
}

function writeFile(writeFilePath, contents) {
  const dirPath = path.dirname(writeFilePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath);
  }
  fs.writeFileSync(writeFilePath, contents);
}

function getFilePathRelativeToDumpDir(filePath) {
  let pathParts = filePath.split('\\plug\\');

  // Windows
  if (pathParts.length > 1) {
    return pathParts[1];
  }

  // Unix
  pathParts = filePath.split('/plug/');
  return pathParts[1];
}

function dumpAllFilesInTempDir(tempDirName) {
  createAssets().forEach((currentReadFilePath) => {
    if (!fs.existsSync(currentReadFilePath)) {
      throw new Error('The file `' + currentReadFilePath + '` is missing');
    }

    const relFilePathToDumpDir =
      getFilePathRelativeToDumpDir(currentReadFilePath);

    const writeFilePath = path.join(tempDirName, relFilePathToDumpDir);

    const contents = fs.readFileSync(currentReadFilePath);
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
  args,
) {
  const tempDirObj = tmp.dirSync({
    unsafeCleanup: true,
  });

  dumpAllFilesInTempDir(tempDirObj.name);

  return subProcess.execute(
    command,
    [
      ...baseargs,
      ...buildArgs(
        targetFile,
        allowMissing,
        tempDirObj.name,
        includeDevDeps,
        args,
      ),
    ],
    {cwd: root},
  )
    .then((output) => {
      tempDirObj.removeCallback();
      return JSON.parse(output);
    })
    .catch((error) => {
      tempDirObj.removeCallback();
      if (typeof error === 'string') {
        if (error.indexOf('Required packages missing') !== -1) {
          let errMsg = error + '\nPlease run `pip install -r ' + targetFile + '`';
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
  extraArgs: string[],
) {
  const pathToRun = path.join(tempDirPath, 'pip_resolve.py');
  let args = [pathToRun];
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
