import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';

import * as subProcess from './sub-process';
import { DepGraph } from '@snyk/dep-graph';
import { buildDepGraph, PartialDepTree } from './build-dep-graph';
import { FILENAMES } from '../types';
import {
  EmptyManifestError,
  FailedToWriteTempFiles,
  RequiredPackagesMissingError,
  UnparsableRequirementError,
} from '../errors';

const returnedTargetFile = (originalTargetFile) => {
  const basename = path.basename(originalTargetFile);

  switch (basename) {
    case FILENAMES.poetry.lockfile: {
      const dirname = path.dirname(originalTargetFile);
      const pyprojectRelativePath = path.join(
        dirname,
        FILENAMES.poetry.manifest
      );

      return pyprojectRelativePath;
    }
    case FILENAMES.pipenv.manifest:
    case FILENAMES.setuptools.manifest:
      return originalTargetFile;
    default:
      return;
  }
};

export function getMetaData(
  command: string,
  baseargs: string[],
  root: string,
  targetFile: string
) {
  const pythonEnv = getPythonEnv(targetFile);

  return subProcess
    .execute(command, [...baseargs, '--version'], { cwd: root, env: pythonEnv })
    .then((output) => {
      return {
        name: 'snyk-python-plugin',
        runtime: output.replace('\n', ''),
        targetFile: returnedTargetFile(targetFile),
      };
    });
}

// path.join calls have to be exactly in this format, needed by "pkg" to build a standalone Snyk CLI binary:
// https://www.npmjs.com/package/pkg#detecting-assets-in-source-code
function createAssets() {
  return [
    path.join(__dirname, '../../pysrc/constants.py'),
    path.join(__dirname, '../../pysrc/pip_resolve.py'),
    path.join(__dirname, '../../pysrc/distPackage.py'),
    path.join(__dirname, '../../pysrc/package.py'),
    path.join(__dirname, '../../pysrc/pipfile.py'),
    path.join(__dirname, '../../pysrc/reqPackage.py'),
    path.join(__dirname, '../../pysrc/setup_file.py'),
    path.join(__dirname, '../../pysrc/utils.py'),
    path.join(__dirname, '../../pysrc/pkg_resources.py'),

    path.join(__dirname, '../../pysrc/requirements/fragment.py'),
    path.join(__dirname, '../../pysrc/requirements/parser.py'),
    path.join(__dirname, '../../pysrc/requirements/requirement.py'),
    path.join(__dirname, '../../pysrc/requirements/vcs.py'),
    path.join(__dirname, '../../pysrc/requirements/__init__.py'),

    path.join(__dirname, '../../pysrc/pytoml/__init__.py'),
    path.join(__dirname, '../../pysrc/pytoml/core.py'),
    path.join(__dirname, '../../pysrc/pytoml/parser.py'),
    path.join(__dirname, '../../pysrc/pytoml/writer.py'),
    path.join(
      __dirname,
      '../../pysrc/pkg_resources_py2/_vendor/packaging/version.py'
    ),
    path.join(
      __dirname,
      '../../pysrc/pkg_resources_py2/_vendor/packaging/__init__.py'
    ),
    path.join(
      __dirname,
      '../../pysrc/pkg_resources_py2/_vendor/packaging/utils.py'
    ),
    path.join(
      __dirname,
      '../../pysrc/pkg_resources_py2/_vendor/packaging/requirements.py'
    ),
    path.join(
      __dirname,
      '../../pysrc/pkg_resources_py2/_vendor/packaging/_structures.py'
    ),
    path.join(
      __dirname,
      '../../pysrc/pkg_resources_py2/_vendor/packaging/markers.py'
    ),
    path.join(
      __dirname,
      '../../pysrc/pkg_resources_py2/_vendor/packaging/__about__.py'
    ),
    path.join(
      __dirname,
      '../../pysrc/pkg_resources_py2/_vendor/packaging/_compat.py'
    ),
    path.join(
      __dirname,
      '../../pysrc/pkg_resources_py2/_vendor/packaging/specifiers.py'
    ),
    path.join(__dirname, '../../pysrc/pkg_resources_py2/_vendor/__init__.py'),
    path.join(__dirname, '../../pysrc/pkg_resources_py2/_vendor/appdirs.py'),
    path.join(__dirname, '../../pysrc/pkg_resources_py2/_vendor/six.py'),
    path.join(__dirname, '../../pysrc/pkg_resources_py2/_vendor/pyparsing.py'),
    path.join(__dirname, '../../pysrc/pkg_resources_py2/extern/__init__.py'),
    path.join(__dirname, '../../pysrc/pkg_resources_py2/py31compat.py'),
    path.join(__dirname, '../../pysrc/pkg_resources_py2/__init__.py'),
    path.join(
      __dirname,
      '../../pysrc/pkg_resources_py3/_vendor/packaging/tags.py'
    ),
    path.join(
      __dirname,
      '../../pysrc/pkg_resources_py3/_vendor/packaging/_musllinux.py'
    ),
    path.join(
      __dirname,
      '../../pysrc/pkg_resources_py3/_vendor/packaging/version.py'
    ),
    path.join(
      __dirname,
      '../../pysrc/pkg_resources_py3/_vendor/packaging/__init__.py'
    ),
    path.join(
      __dirname,
      '../../pysrc/pkg_resources_py3/_vendor/packaging/utils.py'
    ),
    path.join(
      __dirname,
      '../../pysrc/pkg_resources_py3/_vendor/packaging/requirements.py'
    ),
    path.join(
      __dirname,
      '../../pysrc/pkg_resources_py3/_vendor/packaging/_structures.py'
    ),
    path.join(
      __dirname,
      '../../pysrc/pkg_resources_py3/_vendor/packaging/markers.py'
    ),
    path.join(
      __dirname,
      '../../pysrc/pkg_resources_py3/_vendor/packaging/__about__.py'
    ),
    path.join(
      __dirname,
      '../../pysrc/pkg_resources_py3/_vendor/packaging/_manylinux.py'
    ),
    path.join(
      __dirname,
      '../../pysrc/pkg_resources_py3/_vendor/packaging/specifiers.py'
    ),
    path.join(__dirname, '../../pysrc/pkg_resources_py3/_vendor/__init__.py'),
    path.join(__dirname, '../../pysrc/pkg_resources_py3/_vendor/appdirs.py'),
    path.join(__dirname, '../../pysrc/pkg_resources_py3/_vendor/pyparsing.py'),
    path.join(__dirname, '../../pysrc/pkg_resources_py3/__init__.py'),
    path.join(__dirname, '../../pysrc/pkg_resources_py3/extern/__init__.py'),

    path.join(__dirname, '../../pysrc/pkg_resources_py3_12/__init__.py'),
  ];
}

function writeFile(writeFilePath: string, contents: string) {
  const dirPath = path.dirname(writeFilePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
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

    const relFilePathToDumpDir =
      getFilePathRelativeToDumpDir(currentReadFilePath);

    const writeFilePath = path.join(tempDirName, relFilePathToDumpDir);

    const contents = fs.readFileSync(currentReadFilePath, 'utf8');
    writeFile(writeFilePath, contents);
  });
}

export async function inspectInstalledDeps(
  command: string,
  baseargs: string[],
  root: string,
  targetFile: string,
  allowMissing: boolean,
  includeDevDeps: boolean,
  allowEmpty: boolean,
  args?: string[],
  projectName?: string
): Promise<DepGraph> {
  const tmp_path = process.env.SNYK_TMP_PATH;
  let tempDirObj: tmp.DirResult;

  try {
    tempDirObj = tmp.dirSync({
      unsafeCleanup: true,
      ...(tmp_path ? { tmpdir: tmp_path } : {}),
    });
    dumpAllFilesInTempDir(tempDirObj.name);
  } catch (e) {
    throw new FailedToWriteTempFiles(
      `Failed to write temporary files:\n` +
        `${e}\n` +
        `Try running again with SNYK_TMP_PATH=<some directory>, where <some directory> is a valid directory that you have permissions to write to.`
    );
  }

  try {
    const pythonEnv = getPythonEnv(targetFile);

    // See ../../pysrc/README.md
    const output = await subProcess.execute(
      command,
      [
        ...baseargs,
        ...buildArgs(
          targetFile,
          allowMissing,
          allowEmpty,
          tempDirObj.name,
          includeDevDeps,
          args
        ),
      ],
      {
        cwd: root,
        env: pythonEnv,
      }
    );

    const result = JSON.parse(output) as PartialDepTree;
    return buildDepGraph(result, projectName);
  } catch (error) {
    if (typeof error === 'string') {
      const emptyManifestMsg = 'No dependencies detected in manifest.';
      const noDependenciesDetected = error.includes(emptyManifestMsg);

      if (noDependenciesDetected) {
        throw new EmptyManifestError(emptyManifestMsg);
      }

      if (error.indexOf('Required packages missing') !== -1) {
        let errMsg = error;
        if (path.basename(targetFile) === FILENAMES.pipenv.manifest) {
          errMsg += '\nPlease run `pipenv update`.';
        } else if (
          path.basename(targetFile) === FILENAMES.setuptools.manifest
        ) {
          errMsg += '\nPlease run `pip install -e .`.';
        } else {
          errMsg += '\nPlease run `pip install -r ' + targetFile + '`.';
        }
        errMsg += ' If the issue persists try again with --skip-unresolved.';

        throw new RequiredPackagesMissingError(errMsg);
      }

      if (error.indexOf('Unparsable requirement line') !== -1) {
        throw new UnparsableRequirementError(error);
      }
    }

    throw error;
  } finally {
    tempDirObj.removeCallback();
  }
}

export function getPythonEnv(targetFile: string) {
  if (path.basename(targetFile) === 'Pipfile') {
    const envOverrides = {
      PIPENV_PIPFILE: targetFile,
    };
    return { ...process.env, ...envOverrides };
  } else {
    return process.env;
  }
}

// Exported for tests only
export function buildArgs(
  targetFile: string,
  allowMissing: boolean,
  allowEmpty: boolean,
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
  if (allowEmpty) {
    args.push('--allow-empty');
  }
  if (includeDevDeps) {
    args.push('--dev-deps');
  }
  if (extraArgs) {
    args = args.concat(extraArgs);
  }
  return args;
}
