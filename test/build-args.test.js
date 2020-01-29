const test = require('tap').test;
const buildArgs = require('../lib/dependencies/inspect-implementation')
  .buildArgs;

test('check build args with array', (t) => {
  const result = buildArgs('requirements.txt', false, '../pysrc', false, [
    '-argOne',
    '-argTwo',
  ]);
  t.match(result[0], /.*[/\\]pysrc[/\\]pip_resolve\.py/);
  t.deepEqual(result.slice(1), ['requirements.txt', '-argOne', '-argTwo']);
  t.end();
});

test('check build args with array & allowMissing', (t) => {
  const result = buildArgs('requirements.txt', true, '../pysrc', false, [
    '-argOne',
    '-argTwo',
  ]);
  t.match(result[0], /.*[/\\]pysrc[/\\]pip_resolve\.py/);
  t.deepEqual(result.slice(1), [
    'requirements.txt',
    '--allow-missing',
    '-argOne',
    '-argTwo',
  ]);
  t.end();
});

test('check build args with array & devDeps', (t) => {
  const result = buildArgs('requirements.txt', false, '../pysrc', true, [
    '-argOne',
    '-argTwo',
  ]);
  t.match(result[0], /.*[/\\]pysrc[/\\]pip_resolve\.py/);
  t.deepEqual(result.slice(1), [
    'requirements.txt',
    '--dev-deps',
    '-argOne',
    '-argTwo',
  ]);
  t.end();
});

test('check build args with array & allowMissing & devDeps', (t) => {
  const result = buildArgs('requirements.txt', true, '../pysrc', true, [
    '-argOne',
    '-argTwo',
  ]);
  t.match(result[0], /.*[/\\]pysrc[/\\]pip_resolve\.py/);
  t.deepEqual(result.slice(1), [
    'requirements.txt',
    '--allow-missing',
    '--dev-deps',
    '-argOne',
    '-argTwo',
  ]);
  t.end();
});

test('check build args with string', (t) => {
  const result = buildArgs(
    'requirements.txt',
    false,
    '../pysrc',
    false,
    '-argOne -argTwo'
  );
  t.match(result[0], /.*[/\\]pysrc[/\\]pip_resolve\.py/);
  t.deepEqual(result.slice(1), ['requirements.txt', '-argOne -argTwo']);
  t.end();
});

test('check build args with string & allowMissing', (t) => {
  const result = buildArgs(
    'requirements.txt',
    true,
    '../pysrc',
    false,
    '-argOne -argTwo'
  );
  t.match(result[0], /.*[/\\]pysrc[/\\]pip_resolve\.py/);
  t.deepEqual(result.slice(1), [
    'requirements.txt',
    '--allow-missing',
    '-argOne -argTwo',
  ]);
  t.end();
});
