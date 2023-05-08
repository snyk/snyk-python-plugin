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
});
