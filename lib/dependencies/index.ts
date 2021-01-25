import * as path from 'path';
import * as subProcess from './sub-process';

import { legacyPlugin as api } from '@snyk/cli-interface';
import { getMetaData, inspectInstalledDeps } from './inspect-implementation';
import { getPoetryDependencies } from './poetry';
import { FILENAMES } from '../types';

export interface PythonInspectOptions {
  command?: string; // `python` command override
  python?: string;
  allowMissing?: boolean; // Allow skipping packages that are not found in the environment.
  args?: string[];
}

type Options = api.SingleSubprojectInspectOptions & PythonInspectOptions;

// Given a path to a manifest file and assuming that all the packages (transitively required by the
// manifest) were installed (e.g. using `pip install`), produce a tree of dependencies.
export async function getDependencies(
  root: string,
  targetFile: string,
  options?: Options
): Promise<api.SinglePackageResult> {
  if (!options) {
    options = {};
  }

  if (options.python && options.python !== '2' && options.python !== '3') {
    throw new Error(
      'The --python property can be used only as --python=2 or --python=3'
    );
  }

  const python = options.python ? `python${options.python}` : 'python';

  let command = options.command || python;
  const includeDevDeps = !!(options.dev || false);

  // handle poetry projects by parsing manifest & lockfile and return a dep-graph
  if (path.basename(targetFile) === FILENAMES.poetry.manifest) {
    return getPoetryDependencies(command, root, targetFile, includeDevDeps);
  }

  let baseargs: string[] = [];
  if (path.basename(targetFile) === FILENAMES.pipenv.manifest) {
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
    inspectInstalledDeps(
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
