import { getPoetryDependencies } from '../../lib/dependencies/poetry';
import * as path from 'path';
import { FILENAMES } from '../../lib/types';
import * as poetry from 'snyk-poetry-lockfile-parser';

describe('getPoetryDepencies', () => {
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
