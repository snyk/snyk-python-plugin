import * as path from 'path';
import * as subProcess from './sub-process';
import * as fs from 'fs';
import * as tmp from 'tmp';

// TODO(kyegupov): find a nicer way to export/import namespaced types from cli-interface
import { legacy } from '@snyk/cli-interface';
type SingleSubprojectInspectOptions = legacy.pluginInterface.SingleSubprojectInspectOptions;
// TODO(kyegupov): those two types below should also come from '@snyk/cli-interface'
interface DepTreeDep {
  name?: string;
  version?: string;
  dependencies?: {
    [depName: string]: DepTreeDep;
  };
}
interface DepTree extends DepTreeDep {
  type?: string;
  packageFormatVersion?: string;
  targetOS?: {
    name: string;
    version: string;
  };
  labels?: {
    [key: string]: string;
  };
  targetFile?: string;
  policy?: string;
  docker?: any;
  files?: any;
}

export const __tests = {
  buildArgs,
};

export interface PythonInspectOptions {
  command?: string;
  allowMissing?: boolean;
  args?: string[];
}

type Options = SingleSubprojectInspectOptions & PythonInspectOptions;

export async function inspect(
  root: string,
  targetFile: string,
  options: Options
) {
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
        'Failed to run `pipenv`; please make sure it is installed.'
      );
    }
    command = 'pipenv';
    baseargs = ['run', 'python'];
  }

  const [plugin, pkg] = await Promise.all([
    getMetaData(command, baseargs, root, targetFile),
    getDependencies(
      command,
      baseargs,
      root,
      targetFile,
      options.allowMissing || false,
      includeDevDeps,
      options.args
    ),
  ]);
  return { plugin, package: pkg };
}

function getMetaData(
  command: string,
  baseargs: string[],
  root: string,
  targetFile: string
) {
  return subProcess
    .execute(command, [...baseargs, '--version'], { cwd: root })
    .then((output) => {
      return {
        name: 'snyk-python-plugin',
        runtime: output.replace('\n', ''),
        // specify targetFile only in case of Pipfile
        targetFile:
          path.basename(targetFile) === 'Pipfile' ? targetFile : undefined,
      };
    });
}

// path.join calls have to be exactly in this format, needed by "pkg" to build a standalone Snyk CLI binary:
// https://www.npmjs.com/package/pkg#detecting-assets-in-source-code
function createAssets() {
  return [
    path.join(__dirname, '../pysrc/pip_resolve.py'),
    path.join(__dirname, '../pysrc/distPackage.py'),
    path.join(__dirname, '../pysrc/package.py'),
    path.join(__dirname, '../pysrc/pipfile.py'),
    path.join(__dirname, '../pysrc/reqPackage.py'),
    path.join(__dirname, '../pysrc/utils.py'),

    path.join(__dirname, '../pysrc/requirements/fragment.py'),
    path.join(__dirname, '../pysrc/requirements/parser.py'),
    path.join(__dirname, '../pysrc/requirements/requirement.py'),
    path.join(__dirname, '../pysrc/requirements/vcs.py'),
    path.join(__dirname, '../pysrc/requirements/__init__.py'),

    path.join(__dirname, '../pysrc/pytoml/__init__.py'),
    path.join(__dirname, '../pysrc/pytoml/core.py'),
    path.join(__dirname, '../pysrc/pytoml/parser.py'),
    path.join(__dirname, '../pysrc/pytoml/writer.py'),
  ];
}

function writeFile(writeFilePath: string, contents: string) {
  const dirPath = path.dirname(writeFilePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath);
  }
  fs.writeFileSync(writeFilePath, contents);
}

function getFilePathRelativeToDumpDir(filePath: string) {
  let pathParts = filePath.split('\\pysrc\\');

  // Windows
  if (pathParts.length > 1) {
    return pathParts[1];
  }

  // Unix
  pathParts = filePath.split('/pysrc/');
  return pathParts[1];
}

function dumpAllFilesInTempDir(tempDirName: string) {
  createAssets().forEach((currentReadFilePath) => {
    if (!fs.existsSync(currentReadFilePath)) {
      throw new Error('The file `' + currentReadFilePath + '` is missing');
    }

    const relFilePathToDumpDir = getFilePathRelativeToDumpDir(
      currentReadFilePath
    );

    const writeFilePath = path.join(tempDirName, relFilePathToDumpDir);

    const contents = fs.readFileSync(currentReadFilePath, 'utf8');
    writeFile(writeFilePath, contents);
  });
}

async function getDependencies(
  command: string,
  baseargs: string[],
  root: string,
  targetFile: string,
  allowMissing: boolean,
  includeDevDeps: boolean,
  args?: string[]
): Promise<DepTree> {
  const tempDirObj = tmp.dirSync({
    unsafeCleanup: true,
  });

  dumpAllFilesInTempDir(tempDirObj.name);
  try {
    const output = await subProcess.execute(
      command,
      [
        ...baseargs,
        ...buildArgs(
          targetFile,
          allowMissing,
          tempDirObj.name,
          includeDevDeps,
          args
        ),
      ],
      { cwd: root }
    );
    return JSON.parse(output) as DepTree;
  } catch (error) {
    if (typeof error === 'string') {
      if (error.indexOf('Required packages missing') !== -1) {
        let errMsg = error + '\nPlease run `pip install -r ' + targetFile + '`';
        if (path.basename(targetFile) === 'Pipfile') {
          errMsg = 'Please run `pipenv update`';
        }
        throw new Error(errMsg);
      }
    }
    throw error;
  } finally {
    tempDirObj.removeCallback();
  }
}

function buildArgs(
  targetFile: string,
  allowMissing: boolean,
  tempDirPath: string,
  includeDevDeps: boolean,
  extraArgs?: string[]
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
