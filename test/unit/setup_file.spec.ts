import path = require('path');
import { executeSync } from '../../lib/dependencies/sub-process';

describe('Test setup_file.py', () => {
  it.each`
    setupPyContent
    ${'import setuptools;setuptools.setup(name="test")'}
    ${'from setuptools import setup;setup(name="test")'}
  `("parse works for '$setupPyContent'", ({ setupPyContent }) => {
    const result = executeSync(
      'python',
      ['-c', `from setup_file import parse; parse('${setupPyContent}')`],
      { cwd: path.resolve(__dirname, '../../pysrc') }
    );

    expect(result.status).toBe(0);
  });

  it('should work when --dev-deps is set but not dev-packages in Pipfile', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/pipfile-without-dev-deps/Pipfile'
    );

    const result = executeSync(
      'python',
      [
        '-c',
        `from pip_resolve import get_requirements_list; get_requirements_list('${fixturePath}', True)`,
      ],
      { cwd: path.resolve(__dirname, '../../pysrc') }
    );
    expect(result.status).toBe(0);
  });
});
