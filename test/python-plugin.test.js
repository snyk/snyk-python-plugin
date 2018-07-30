var test = require('tap').test;
var plugin = require('../lib').__tests;

test('check build args with array', function (t) {
  var result = plugin.buildArgs('requirements.txt', false, "../plug", false, [
    '-argOne',
    '-argTwo',
  ]);
  t.match(result[0], /.*\/plug\/pip_resolve\.py/);
  t.deepEqual(result.slice(1), [
    'requirements.txt',
    '-argOne',
    '-argTwo',
  ]);
  t.end();
});

test('check build args with array & allowMissing', function (t) {
  var result = plugin.buildArgs('requirements.txt', true, "../plug", false, [
    '-argOne',
    '-argTwo',
  ]);
  t.match(result[0], /.*\/plug\/pip_resolve\.py/);
  t.deepEqual(result.slice(1), [
    'requirements.txt',
    '--allow-missing',
    '-argOne',
    '-argTwo',
  ]);
  t.end();
});

test('check build args with array & devDeps', function (t) {
  var result = plugin.buildArgs('requirements.txt', false, "../plug", true, [
    '-argOne',
    '-argTwo',
  ]);
  t.match(result[0], /.*\/plug\/pip_resolve\.py/);
  t.deepEqual(result.slice(1), [
    'requirements.txt',
    '--dev-deps',
    '-argOne',
    '-argTwo',
  ]);
  t.end();
});

test('check build args with array & allowMissing & devDeps', function (t) {
  var result = plugin.buildArgs('requirements.txt', true, "../plug", true, [
    '-argOne',
    '-argTwo',
  ]);
  t.match(result[0], /.*\/plug\/pip_resolve\.py/);
  t.deepEqual(result.slice(1), [
    'requirements.txt',
    '--allow-missing',
    '--dev-deps',
    '-argOne',
    '-argTwo',
  ]);
  t.end();
});

test('check build args with string', function (t) {
  var result = plugin.buildArgs('requirements.txt', false, "../plug", false, '-argOne -argTwo');
  t.match(result[0], /.*\/plug\/pip_resolve\.py/);
  t.deepEqual(result.slice(1), [
    'requirements.txt',
    '-argOne -argTwo',
  ]);
  t.end();
});

test('check build args with string & allowMissing', function (t) {
  var result = plugin.buildArgs('requirements.txt', true, "../plug", false, '-argOne -argTwo');
  t.match(result[0], /.*\/plug\/pip_resolve\.py/);
  t.deepEqual(result.slice(1), [
    'requirements.txt',
    '--allow-missing',
    '-argOne -argTwo',
  ]);
  t.end();
});
