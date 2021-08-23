/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from 'tap';
import { chdirWorkspaces, activateVirtualenv } from '../test-utils';
import * as depGraphLib from '@snyk/dep-graph';

import pluginImpl = require('../../lib');

const pipAppExpectedDependenciesOnlyProvenance = {
  django: {
    data: {
      name: 'django',
      version: '1.6.1',
      labels: { provenance: 'requirements.txt:2' },
    },
    msg: 'django looks ok',
  },
  jinja2: {
    data: {
      name: 'jinja2',
      version: '2.7.2',
      labels: { provenance: 'requirements.txt:1' },
    },
    msg: 'jinja2 looks ok',
  },
  'python-etcd': {
    data: {
      name: 'python-etcd',
      version: '0.4.5',
      labels: { provenance: 'requirements.txt:3' },
    },
    msg: 'python-etcd is ok',
  },
  'django-select2': {
    data: {
      name: 'django-select2',
      version: '6.0.1',
      labels: { provenance: 'requirements.txt:4' },
    },
    msg: 'django-select2 looks ok',
  },
  irc: {
    data: {
      name: 'irc',
      version: '16.2',
      labels: { provenance: 'requirements.txt:5' },
    },
    msg: 'irc ok, even though it has a cyclic dep, yay!',
  },
  testtools: {
    data: {
      name: 'testtools',
      version: '2.3.0',
      labels: { provenance: 'requirements.txt:6' },
    },
    msg: "testtools ok, even though it's cyclic, yay!",
  },
};

test('inspect --only-provenance', async (t) => {
  chdirWorkspaces('pip-app');
  t.teardown(activateVirtualenv('pip-app'));
  const result = await pluginImpl.inspect('.', 'requirements.txt', {
    args: ['--only-provenance'],
  });
  const plugin = result.plugin;
  const dependencyGraph = result.dependencyGraph;
  const pkg = await depGraphLib.legacy.graphToDepTree(dependencyGraph, 'pip');

  t.test('plugin', async (t) => {
    t.ok(plugin, 'plugin');
    t.equal(plugin.name, 'snyk-python-plugin', 'name');
    t.match(plugin.runtime, 'Python', 'runtime');
    t.notOk(plugin.targetFile, 'no targetfile for requirements.txt');
  });

  t.test('package', async (t) => {
    t.ok(pkg, 'package');
    t.equal(pkg.name, 'pip-app', 'name');
    t.equal(pkg.version, '0.0.0', 'version');
  });

  t.test('package dependencies', async (t) => {
    Object.keys(pipAppExpectedDependenciesOnlyProvenance).forEach((depName) => {
      t.match(
        pkg.dependencies![depName],
        pipAppExpectedDependenciesOnlyProvenance[depName].data as any,
        pipAppExpectedDependenciesOnlyProvenance[depName].msg as string
      );
    });
  });
});

const pipfileExpectedDependenciesOnlyProvenance = {
  jinja2: {
    data: {
      name: 'jinja2',
      version: '2.7.2',
      labels: { provenance: 'Pipfile:9' },
    },
    msg: 'jinja2 looks ok',
  },
  'python-etcd': {
    data: {
      name: 'python-etcd',
      version: '0.4.5',
      labels: { provenance: 'Pipfile:7' },
    },
    msg: 'python-etcd is ok',
  },
  'django-select2': {
    data: {
      name: 'django-select2',
      version: '6.0.1',
      labels: { provenance: 'Pipfile:11' },
    },
    msg: 'django-select2 looks ok',
  },
  testtools: {
    data: {
      name: 'testtools',
      version: '2.3.0',
      labels: { provenance: 'Pipfile:8' },
    },
    msg: "testtools ok, even though it's cyclic, yay!",
  },
};

test('inspect --only-provenance for Pipfile', async (t) => {
  chdirWorkspaces('pipfile-pipapp');
  t.teardown(activateVirtualenv('pip-app'));
  const result = await pluginImpl.inspect('.', 'Pipfile', {
    args: ['--only-provenance'],
  });
  const plugin = result.plugin;
  const dependencyGraph = result.dependencyGraph;
  const pkg = await depGraphLib.legacy.graphToDepTree(dependencyGraph, 'pip');

  t.test('plugin', async (t) => {
    t.ok(plugin, 'plugin');
    t.equal(plugin.name, 'snyk-python-plugin', 'name');
    t.match(plugin.runtime, 'Python', 'runtime');
    t.match(plugin.targetFile, 'Pipfile');
  });

  t.test('package', async (t) => {
    t.ok(pkg, 'package');
    t.equal(pkg.name, 'pipfile-pipapp', 'name');
    t.equal(pkg.version, '0.0.0', 'version');
  });

  t.notOk(pkg.dependencies!['django'], 'django skipped (editable)');

  t.test('package dependencies', async (t) => {
    Object.keys(pipfileExpectedDependenciesOnlyProvenance).forEach(
      (depName) => {
        t.match(
          pkg.dependencies![depName],
          pipfileExpectedDependenciesOnlyProvenance[depName].data as any,
          pipfileExpectedDependenciesOnlyProvenance[depName].msg as string
        );
      }
    );
  });
});

const setupPyAppExpectedDependenciesProvenance = {
  django: {
    data: {
      name: 'django',
      version: '1.6.1',
      labels: { provenance: 'setup.py:8' },
    },
    msg: 'django looks ok',
  },
  jinja2: {
    data: {
      name: 'jinja2',
      version: '2.7.2',
      labels: { provenance: 'setup.py:8' },
    },
    msg: 'jinja2 looks ok',
  },
  'python-etcd': {
    data: {
      name: 'python-etcd',
      version: '0.4.5',
      labels: { provenance: 'setup.py:8' },
    },
    msg: 'python-etcd is ok',
  },
  'django-select2': {
    data: {
      name: 'django-select2',
      version: '6.0.1',
      labels: { provenance: 'setup.py:8' },
    },
    msg: 'django-select2 looks ok',
  },
  irc: {
    data: {
      name: 'irc',
      version: '16.2',
      labels: { provenance: 'setup.py:8' },
    },
    msg: 'irc ok, even though it has a cyclic dep, yay!',
  },
  testtools: {
    data: {
      name: 'testtools',
      version: '2.3.0',
      labels: { provenance: 'setup.py:8' },
    },
    msg: "testtools ok, even though it's cyclic, yay!",
  },
};

test('inspect setup.py', async (t) => {
  chdirWorkspaces('setup_py-app');
  t.teardown(activateVirtualenv('pip-app'));
  const result = await pluginImpl.inspect('.', 'setup.py', {
    args: ['--only-provenance'],
  });
  const plugin = result.plugin;
  const dependencyGraph = result.dependencyGraph;
  const pkg = await depGraphLib.legacy.graphToDepTree(dependencyGraph, 'pip');

  t.test('plugin', async (t) => {
    t.ok(plugin, 'plugin');

    t.equal(plugin.name, 'snyk-python-plugin', 'name');
    t.match(plugin.runtime, 'Python', 'runtime');
    t.equal(plugin.targetFile, 'setup.py', 'targetfile is setup.py');
  });

  t.test('package', async (t) => {
    t.ok(pkg, 'package');
    t.equal(pkg.name, 'test_package', 'name');
    t.equal(pkg.version, '1.0.2', 'version');
  });

  t.test('package dependencies', async (t) => {
    Object.keys(setupPyAppExpectedDependenciesProvenance).forEach((depName) => {
      t.match(
        pkg.dependencies![depName],
        setupPyAppExpectedDependenciesProvenance[depName].data,
        setupPyAppExpectedDependenciesProvenance[depName].msg
      );
    });
  });
});
