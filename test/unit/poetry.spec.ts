import { getPoetryDependencies } from '../../lib/dependencies/poetry';
import * as path from 'path';
import { FILENAMES } from '../../lib/types';
import * as poetry from 'snyk-poetry-lockfile-parser';
import * as inspectImpl from '../../lib/dependencies/inspect-implementation';

const POETRY_APP_ROOT = path.join(__dirname, '..', 'workspaces', 'poetry-app');

const mockDepGraph = { type: 'mock-dep-graph' };
const mockPlugin = {
  name: 'snyk-python-plugin',
  runtime: 'Python 3.10.0',
  targetFile: FILENAMES.poetry.manifest,
};

describe('getPoetryDepencies', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should use absolute targetFile path directly without joining to root', async () => {
    jest.spyOn(poetry, 'buildDepGraph').mockReturnValue(mockDepGraph as any);
    jest.spyOn(inspectImpl, 'getMetaData').mockResolvedValue(mockPlugin as any);

    const unrelatedRoot = '/some/bogus/root';
    const absoluteTargetFile = path.join(
      POETRY_APP_ROOT,
      FILENAMES.poetry.lockfile
    );

    const result = await getPoetryDependencies(
      'python',
      unrelatedRoot,
      absoluteTargetFile
    );

    expect(result).toEqual({
      plugin: mockPlugin,
      package: null,
      dependencyGraph: mockDepGraph,
    });
    expect(poetry.buildDepGraph).toHaveBeenCalledTimes(1);
  });

  it('should throw exception when manifest does not exist', async () => {
    expect.assertions(1);
    const root = 'rootPath';
    const targetFile = 'non-existant-target-file';
    try {
      await getPoetryDependencies('python', root, targetFile);
    } catch (e) {
      const expectedPath = path.join(root, FILENAMES.poetry.manifest);
      const expected = new Error(`Cannot find manifest file ${expectedPath}`);
      expect(e).toEqual(expected);
    }
  });

  it('should throw exception when lockfile does not exist', async () => {
    expect.assertions(1);
    const root = path.join(
      __dirname,
      '..',
      'workspaces',
      'poetry-app-without-lockfile'
    );
    const targetFile = FILENAMES.poetry.lockfile;
    try {
      await getPoetryDependencies('python', root, targetFile);
    } catch (e) {
      const expectedPath = path.join(root, FILENAMES.poetry.lockfile);
      const expected = new Error(`Cannot find lockfile ${expectedPath}`);
      expect(e).toEqual(expected);
    }
  });

  it('should throw exception when lockfile parser throws exception', async () => {
    expect.assertions(1);
    const poetryError = new Error('some poetry error msg');
    jest.spyOn(poetry, 'buildDepGraph').mockImplementation(() => {
      throw poetryError;
    });

    const root = path.join(__dirname, '..', 'workspaces', 'poetry-app');
    const targetFile = 'pyproject.toml';
    try {
      await getPoetryDependencies('python', root, targetFile);
    } catch (e) {
      const expected = new Error(
        'Error processing poetry project. some poetry error msg'
      );
      expect(e).toEqual(expected);
    }
  });
});
