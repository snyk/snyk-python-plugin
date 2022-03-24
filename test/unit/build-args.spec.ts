import * as path from 'path';
import { buildArgs } from '../../lib/dependencies/inspect-implementation';

describe('build args', () => {
  it('should return expected args', () => {
    const result = buildArgs(
      'requirements.txt',
      false,
      false,
      '../pysrc',
      false,
      ['-argOne', '-argTwo']
    );
    expect(result).toEqual([
      `..${path.sep}pysrc${path.sep}pip_resolve.py`,
      'requirements.txt',
      '-argOne',
      '-argTwo',
    ]);
  });

  it('should return expected args when allowMissing is true', () => {
    const result = buildArgs(
      'requirements.txt',
      true,
      false,
      '../pysrc',
      false,
      ['-argOne', '-argTwo']
    );
    expect(result).toEqual([
      `..${path.sep}pysrc${path.sep}pip_resolve.py`,
      'requirements.txt',
      '--allow-missing',
      '-argOne',
      '-argTwo',
    ]);
  });

  it('should return expected args when includeDevDeps is true', () => {
    const result = buildArgs(
      'requirements.txt',
      false,
      false,
      '../pysrc',
      true,
      ['-argOne', '-argTwo']
    );
    expect(result).toEqual([
      `..${path.sep}pysrc${path.sep}pip_resolve.py`,
      'requirements.txt',
      '--dev-deps',
      '-argOne',
      '-argTwo',
    ]);
  });

  it('should return expected args when allowMissing and includeDevDeps are true', () => {
    const result = buildArgs(
      'requirements.txt',
      true,
      false,
      '../pysrc',
      true,
      ['-argOne', '-argTwo']
    );
    expect(result).toEqual([
      `..${path.sep}pysrc${path.sep}pip_resolve.py`,
      'requirements.txt',
      '--allow-missing',
      '--dev-deps',
      '-argOne',
      '-argTwo',
    ]);
  });
});
