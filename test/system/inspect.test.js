import * as depGraphLib from '@snyk/dep-graph';

const test = require('tap').test;
const fs = require('fs');
const sinon = require('sinon');

const plugin = require('../../lib');
const subProcess = require('../../lib/dependencies/sub-process');
const testUtils = require('../test-utils');
const os = require('os');

const chdirWorkspaces = testUtils.chdirWorkspaces;

function normalize(s = '') {
  return s.replace(/\r/g, '');
}

const pipAppExpectedDependencies = {
  django: {
    data: {
      name: 'django',
      version: '1.6.1',
    },
    msg: 'django looks ok',
  },
  jinja2: {
    data: {
      name: 'jinja2',
      version: '2.7.2',
      dependencies: {
        markupsafe: {
          name: 'markupsafe',
          version: /.+$/,
        },
      },
    },
    msg: 'jinja2 looks ok',
  },
  'python-etcd': {
    data: {
      name: 'python-etcd',
      version: '0.4.5',
      dependencies: {
        dnspython: {
          name: 'dnspython',
          version: /.+$/,
        },
        urllib3: {
          name: 'urllib3',
          version: /.+$/,
        },
      },
    },
    msg: 'python-etcd is ok',
  },
  'django-select2': {
    data: {
      name: 'django-select2',
      version: '6.0.1',
      dependencies: {
        'django-appconf': {
          name: 'django-appconf',
        },
      },
    },
    msg: 'django-select2 looks ok',
  },
  irc: {
    data: {
      name: 'irc',
      version: '16.2',
      dependencies: {
        'more-itertools': {},
        'jaraco.functools': {},
        'jaraco.collections': {
          dependencies: {
            'jaraco.text': {},
          },
        },
        'jaraco.text': {
          dependencies: {
            'jaraco.functools': {},
          },
        },
      },
    },
    msg: 'irc ok, even though it has a cyclic dep, yay!',
  },
  testtools: {
    data: {
      name: 'testtools',
      version: '2.3.0',
      dependencies: {
        pbr: {},
        extras: {},
        fixtures: {},
        unittest2: {},
        traceback2: {},
        'python-mimeparse': {},
      },
    },
    msg: "testtools ok, even though it's cyclic, yay!",
  },
};

const pipfilePinnedExpectedDependencies = {
  django: {
    data: {
      name: 'django',
      version: '1.6.1',
    },
    msg: 'django looks ok',
  },
  jinja2: {
    data: {
      name: 'jinja2',
      version: '2.7.2',
      dependencies: {
        markupsafe: {
          name: 'markupsafe',
          version: /.+$/,
        },
      },
    },
    msg: 'jinja2 looks ok',
  },
  'python-etcd': {
    data: {
      name: 'python-etcd',
      version: '0.4.5',
      dependencies: {
        dnspython: {
          name: 'dnspython',
          version: /.+$/,
        },
        urllib3: {
          name: 'urllib3',
          version: /.+$/,
        },
      },
    },
    msg: 'python-etcd is ok',
  },
  'django-select2': {
    data: {
      name: 'django-select2',
      version: '6.0.1',
      dependencies: {
        'django-appconf': {
          name: 'django-appconf',
        },
      },
    },
    msg: 'django-select2 looks ok',
  },
  irc: {
    data: {
      name: 'irc',
      version: '16.2',
      dependencies: {
        'more-itertools': {},
        'jaraco.functools': {},
        'jaraco.collections': {
          dependencies: {
            'jaraco.text': {},
          },
        },
        'jaraco.text': {
          dependencies: {
            'jaraco.functools': {},
          },
        },
      },
    },
    msg: 'irc ok, even though it has a cyclic dep, yay!',
  },
  testtools: {
    data: {
      name: 'testtools',
      version: '2.3.0',
      dependencies: {
        pbr: {},
        extras: {},
        fixtures: {},
        unittest2: {},
        traceback2: {},
        'python-mimeparse': {},
      },
    },
    msg: "testtools ok, even though it's cyclic, yay!",
  },
};

const setupPyAppExpectedDependencies = {
  django: {
    data: {
      name: 'django',
      version: '1.6.1',
    },
    msg: 'django looks ok',
  },
  jinja2: {
    data: {
      name: 'jinja2',
      version: '2.7.2',
      dependencies: {
        markupsafe: {
          name: 'markupsafe',
          version: /.+$/,
        },
      },
    },
    msg: 'jinja2 looks ok',
  },
  'python-etcd': {
    data: {
      name: 'python-etcd',
      version: '0.4.5',
      dependencies: {
        dnspython: {
          name: 'dnspython',
          version: /.+$/,
        },
        urllib3: {
          name: 'urllib3',
          version: /.+$/,
        },
      },
    },
    msg: 'python-etcd is ok',
  },
  'django-select2': {
    data: {
      name: 'django-select2',
      version: '6.0.1',
      dependencies: {
        'django-appconf': {
          name: 'django-appconf',
        },
      },
    },
    msg: 'django-select2 looks ok',
  },
  irc: {
    data: {
      name: 'irc',
      version: '16.2',
      dependencies: {
        'more-itertools': {},
        'jaraco.functools': {},
        'jaraco.collections': {
          dependencies: {
            'jaraco.text': {},
          },
        },
        'jaraco.text': {
          dependencies: {
            'jaraco.functools': {},
          },
        },
      },
    },
    msg: 'irc ok, even though it has a cyclic dep, yay!',
  },
  testtools: {
    data: {
      name: 'testtools',
      version: '2.3.0',
      dependencies: {
        pbr: {},
        extras: {},
        fixtures: {},
        unittest2: {},
        traceback2: {},
        'python-mimeparse': {},
      },
    },
    msg: "testtools ok, even though it's cyclic, yay!",
  },
};

test('inspect', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('pip-app');
      t.teardown(testUtils.activateVirtualenv('pip-app'));
    })
    .then(() => {
      return plugin.inspect('.', 'requirements.txt');
    })
    .then(async (result) => {
      const plugin = result.plugin;
      const dependencyGraph = result.dependencyGraph;
      const pkg = await depGraphLib.legacy.graphToDepTree(
        dependencyGraph,
        'pip'
      );

      t.test('plugin', (t) => {
        t.ok(plugin, 'plugin');
        t.equal(plugin.name, 'snyk-python-plugin', 'name');
        t.match(plugin.runtime, 'Python', 'runtime');
        t.notOk(plugin.targetFile, 'no targetfile for requirements.txt');
        t.end();
      });

      t.test('package', (t) => {
        t.ok(pkg, 'package');
        t.equal(pkg.name, 'pip-app', 'name');
        t.equal(pkg.version, '0.0.0', 'version');
        t.end();
      });

      t.test('package dependencies', (t) => {
        Object.keys(pipAppExpectedDependencies).forEach((depName) => {
          t.match(
            pkg.dependencies[depName],
            pipAppExpectedDependencies[depName].data,
            pipAppExpectedDependencies[depName].msg
          );
        });

        t.end();
      });

      t.end();
    });
});

test('inspect requirements.txt with bom encoding', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('pip-app-bom');
      const venvCreated = testUtils.ensureVirtualenv('pip-app-bom');
      t.teardown(testUtils.activateVirtualenv('pip-app-bom'));
      if (venvCreated) {
        testUtils.pipInstall();
      }
    })
    .then(() => {
      return plugin.inspect('.', 'requirements.txt').then(async (result) => {
        t.ok('has dependencyGraph property', result.dependencyGraph);
        t.end();
      });
    });
});

test('inspect setup.py', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('setup_py-app');
      t.teardown(testUtils.activateVirtualenv('pip-app'));
    })
    .then(() => {
      return plugin.inspect('.', 'setup.py');
    })
    .then(async (result) => {
      const plugin = result.plugin;
      const dependencyGraph = result.dependencyGraph;
      const pkg = await depGraphLib.legacy.graphToDepTree(
        dependencyGraph,
        'pip'
      );

      t.test('plugin', (t) => {
        t.ok(plugin, 'plugin');
        t.equal(plugin.name, 'snyk-python-plugin', 'name');
        t.match(plugin.runtime, 'Python', 'runtime');
        t.equal(plugin.targetFile, 'setup.py', 'targetfile is setup.py');
        t.end();
      });

      t.test('package', (t) => {
        t.ok(pkg, 'package');
        t.equal(pkg.name, 'test_package', 'name');
        t.equal(pkg.version, '1.0.2', 'version');
        t.end();
      });

      t.test('package dependencies', (t) => {
        Object.keys(setupPyAppExpectedDependencies).forEach((depName) => {
          t.match(
            pkg.dependencies[depName],
            setupPyAppExpectedDependencies[depName].data,
            setupPyAppExpectedDependencies[depName].msg
          );
        });

        t.end();
      });
      t.end();
    });
});

test('inspect setup.py with missing deps', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('setup_py-app');
      t.teardown(testUtils.activateVirtualenv('setup_py-app'));
    })
    .then(() => {
      return plugin.inspect('.', 'setup.py');
    })
    .catch((error) => {
      t.match(normalize(error.message), 'pip install -e .');
    });
});

test('transitive dep not installed', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('pip-app');
      const venvCreated = testUtils.ensureVirtualenv(
        'pip-app-without-markupsafe'
      );
      t.teardown(testUtils.activateVirtualenv('pip-app-without-markupsafe'));
      if (venvCreated) {
        testUtils.pipInstall();
        testUtils.pipUninstall('MarkupSafe');
      }
    })
    .then(() => {
      return plugin
        .inspect('.', 'requirements.txt')
        .then(() => {
          t.fail('should have failed');
        })
        .catch((error) => {
          t.equal(
            normalize(error.message),
            'Required packages missing: markupsafe\n\nPlease run `pip install -r requirements.txt`. ' +
              'If the issue persists try again with --skip-unresolved.'
          );
          t.end();
        });
    });
});

test('transitive dep not installed, but with allowMissing option', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('pip-app');
      const venvCreated = testUtils.ensureVirtualenv(
        'pip-app-without-markupsafe'
      );
      t.teardown(testUtils.activateVirtualenv('pip-app-without-markupsafe'));
      if (venvCreated) {
        testUtils.pipInstall();
        testUtils.pipUninstall('MarkupSafe');
      }
    })
    .then(() => {
      return plugin.inspect('.', 'requirements.txt', { allowMissing: true });
    })
    .then(async (result) => {
      const plugin = result.plugin;
      const dependencyGraph = result.dependencyGraph;
      const pkg = await depGraphLib.legacy.graphToDepTree(
        dependencyGraph,
        'pip'
      );

      t.test('plugin', (t) => {
        t.ok(plugin, 'plugin');
        t.equal(plugin.name, 'snyk-python-plugin', 'name');
        t.match(plugin.runtime, 'Python', 'runtime');
        t.end();
      });

      t.test('package', (t) => {
        t.ok(pkg, 'package');
        t.equal(pkg.name, 'pip-app', 'name');
        t.equal(pkg.version, '0.0.0', 'version');
        t.end();
      });

      t.test('package dependencies', (t) => {
        t.same(
          pkg.dependencies.django,
          {
            name: 'django',
            version: '1.6.1',
          },
          'django looks ok'
        );

        t.match(
          pkg.dependencies.jinja2,
          {
            name: 'jinja2',
            version: '2.7.2',
            dependencies: {},
          },
          'jinja2 looks ok'
        );

        t.match(
          pkg.dependencies['python-etcd'],
          {
            name: 'python-etcd',
            version: '0.4.5',
            dependencies: {
              dnspython: {
                name: 'dnspython',
                version: /.+$/,
              },
              urllib3: {
                name: 'urllib3',
                version: /.+$/,
              },
            },
          },
          'python-etcd is ok'
        );

        t.match(
          pkg.dependencies['django-select2'],
          {
            name: 'django-select2',
            version: '6.0.1',
            dependencies: {
              'django-appconf': {
                name: 'django-appconf',
              },
            },
          },
          'django-select2 looks ok'
        );

        t.end();
      });

      t.end();
    });
});

test('deps not installed', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('pip-app-deps-not-installed');
      t.teardown(testUtils.activateVirtualenv('pip-app'));
    })
    .then(() => {
      return plugin.inspect('.', 'requirements.txt');
    })
    .then(() => {
      t.fail('should have failed');
    })
    .catch((error) => {
      t.equal(
        normalize(error.message),
        'Required packages missing: awss\n\nPlease run `pip install -r requirements.txt`. ' +
          'If the issue persists try again with --skip-unresolved.'
      );
      t.end();
    });
});

test('deps not installed, but with allowMissing option', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('pip-app-deps-not-installed');
      t.teardown(testUtils.activateVirtualenv('pip-app'));
    })
    .then(() => {
      return plugin.inspect('.', 'requirements.txt', { allowMissing: true });
    })
    .then(async (result) => {
      const plugin = result.plugin;
      const dependencyGraph = result.dependencyGraph;
      const pkg = await depGraphLib.legacy.graphToDepTree(
        dependencyGraph,
        'pip'
      );

      t.test('plugin', (t) => {
        t.ok(plugin, 'plugin');
        t.equal(plugin.name, 'snyk-python-plugin', 'name');
        t.match(plugin.runtime, 'Python', 'runtime');
        t.end();
      });

      t.test('package', (t) => {
        t.ok(pkg, 'package');
        t.equal(pkg.name, 'pip-app-deps-not-installed', 'name');
        t.equal(pkg.version, '0.0.0', 'version');
        t.end();
      });

      t.end();
    });
});

test('uses provided exec command', (t) => {
  return Promise.resolve()
    .then(() => {
      const execute = sinon.stub(subProcess, 'execute');
      execute.onFirstCall().returns(Promise.resolve('abc'));
      execute.onSecondCall().returns(Promise.resolve('{}'));
      t.teardown(execute.restore);
      return execute;
    })
    .then((execute) => {
      const command = 'echo';
      return plugin
        .inspect('.', 'requirements.txt', { command: command })
        .then(() => {
          t.ok(execute.calledTwice, 'execute called twice');
          t.equal(execute.firstCall.args[0], command, 'uses command');
          t.equal(execute.secondCall.args[0], command, 'uses command');
          t.end();
        });
    });
});

test('package name differs from requirement (- vs _)', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('pip-app-deps-with-dashes');
      const venvCreated = testUtils.ensureVirtualenv(
        'pip-app-deps-with-dashes'
      );
      t.teardown(testUtils.activateVirtualenv('pip-app-deps-with-dashes'));
      if (venvCreated) {
        testUtils.pipInstall();
      }
    })
    .then(() => {
      return plugin.inspect('.', 'requirements.txt', { allowMissing: true });
    })
    .then(async (result) => {
      const dependencyGraph = result.dependencyGraph;
      const pkg = await depGraphLib.legacy.graphToDepTree(
        dependencyGraph,
        'pip'
      );
      t.same(
        pkg.dependencies['dj-database-url'],
        {
          name: 'dj-database-url',
          version: '0.4.2',
        },
        'dj-database-url looks ok'
      );
      if (os.platform() !== 'win32') {
        t.same(
          pkg.dependencies['posix-ipc'],
          {
            name: 'posix-ipc',
            version: '1.0.0',
          },
          'posix-ipc looks ok'
        );
      }
      t.end();
    });
});

test('package name differs from requirement (- vs .)', (t) => {
  t.pass('Not implemented yet');
  t.end();
});

test('package installed conditionally based on python version', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('pip-app-with-python-markers');
      const venvCreated = testUtils.ensureVirtualenv(
        'pip-app-with-python-markers'
      );
      t.teardown(testUtils.activateVirtualenv('pip-app-with-python-markers'));
      if (venvCreated) {
        testUtils.pipInstall();
      }
    })
    .then(() => {
      return plugin.inspect('.', 'requirements.txt');
    })
    .then(async (result) => {
      const dependencyGraph = result.dependencyGraph;
      const pkg = await depGraphLib.legacy.graphToDepTree(
        dependencyGraph,
        'pip'
      );
      t.notOk(pkg.dependencies.enum34, 'enum34 dep ignored');
      t.ok(pkg.dependencies.click, 'click dep is present');
      t.end();
    });
});

test('should return correct package info when a single package has a dependency more than once', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('pip-app-with-repeating-dependency');
      const venvCreated = testUtils.ensureVirtualenv(
        'pip-app-with-repeating-dependency'
      );
      t.teardown(
        testUtils.activateVirtualenv('pip-app-with-repeating-dependency')
      );
      if (venvCreated) {
        testUtils.pipInstall();
      }
    })
    .then(() => {
      return plugin.inspect('.', 'requirements.txt');
    })
    .then(async (result) => {
      t.ok(result.dependencyGraph, 'graph generated');
      t.end();
    });
});

test('Pipfile package found conditionally based on python version', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('pipfile-markers');
      t.teardown(testUtils.activateVirtualenv('pip-app'));
    })
    .then(() => {
      return plugin.inspect('.', 'Pipfile');
    })
    .catch((error) => {
      t.match(
        normalize(error.message),
        'No dependencies detected in manifest.'
      );
    });
});

test('package depends on platform', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('pip-app-deps-conditional');
      const venvCreated = testUtils.ensureVirtualenv(
        'pip-app-deps-conditional'
      );
      t.teardown(testUtils.activateVirtualenv('pip-app-deps-conditional'));
      if (venvCreated) {
        testUtils.pipInstall();
      }
    })
    .then(() => {
      return plugin.inspect('.', 'requirements.txt', { allowMissing: true });
    })
    .then(async (result) => {
      const dependencyGraph = result.dependencyGraph;
      const pkg = await depGraphLib.legacy.graphToDepTree(
        dependencyGraph,
        'pip'
      );
      if (os.platform() !== 'win32') {
        t.notOk(pkg.dependencies.pypiwin32, 'win32 dep ignored');
        t.same(
          pkg.dependencies['posix-ipc'],
          {
            name: 'posix-ipc',
            version: '1.0.0',
          },
          'posix-ipc looks ok'
        );
      } else {
        t.ok(pkg.dependencies.pypiwin32, 'win32 installed');
        t.notOk(pkg.dependencies['posix-ipc'], 'not win32 dep skipped');
      }
      t.end();
    });
});

test('editables ignored', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('pip-app-deps-editable');
      const venvCreated = testUtils.ensureVirtualenv('pip-app-deps-editable');
      t.teardown(testUtils.activateVirtualenv('pip-app-deps-editable'));
      if (venvCreated) {
        testUtils.pipInstall();
      }
    })
    .then(() => {
      return plugin.inspect('.', 'requirements.txt', { allowMissing: true });
    })
    .then(async (result) => {
      const dependencyGraph = result.dependencyGraph;
      const pkg = await depGraphLib.legacy.graphToDepTree(
        dependencyGraph,
        'pip'
      );
      t.notOk(pkg.dependencies['simple'], 'editable dep ignored');
      t.notOk(pkg.dependencies['sample'], 'editable subdir dep ignored');
      if (os.platform() !== 'win32') {
        t.same(
          pkg.dependencies['posix-ipc'],
          {
            name: 'posix-ipc',
            version: '1.0.0',
          },
          'posix-ipc looks ok'
        );
      }
      t.end();
    });
});

test('deps with options', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('pip-app-with-options');
      const venvCreated = testUtils.ensureVirtualenv('pip-app-with-options');
      t.teardown(testUtils.activateVirtualenv('pip-app-with-options'));
      if (venvCreated) {
        testUtils.pipInstall();
      }
    })
    .then(() => {
      return plugin.inspect('.', 'requirements.txt');
    })
    .then(async (result) => {
      const plugin = result.plugin;
      const dependencyGraph = result.dependencyGraph;
      const pkg = await depGraphLib.legacy.graphToDepTree(
        dependencyGraph,
        'pip'
      );

      t.test('plugin', (t) => {
        t.ok(plugin, 'plugin');
        t.equal(plugin.name, 'snyk-python-plugin', 'name');
        t.match(plugin.runtime, 'Python', 'runtime');
        t.end();
      });

      t.test('package', (t) => {
        t.ok(pkg, 'package');
        t.equal(pkg.name, 'pip-app-with-options', 'name');
        t.equal(pkg.version, '0.0.0', 'version');
        t.end();
      });
      t.test('package dependencies', (t) => {
        t.match(
          pkg.dependencies.markupsafe,
          {
            name: 'markupsafe',
            version: '1.1.1',
          },
          'MarkupSafe looks ok'
        );

        t.match(
          pkg.dependencies.dnspython,
          {
            name: 'dnspython',
            version: '1.13.0',
          },
          'dnspython looks ok'
        );

        t.end();
      });

      t.end();
    });
});

test('trusted host ignored', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('pip-app-trusted-host');
      const venvCreated = testUtils.ensureVirtualenv('pip-app-trusted-host');
      t.teardown(testUtils.activateVirtualenv('pip-app-trusted-host'));
      if (venvCreated) {
        testUtils.pipInstall();
      }
    })
    .then(() => {
      return plugin.inspect('.', 'requirements.txt');
    })
    .then(async (result) => {
      const dependencyGraph = result.dependencyGraph;
      const pkg = await depGraphLib.legacy.graphToDepTree(
        dependencyGraph,
        'pip'
      );
      t.ok(pkg.dependencies, 'does not error');
      t.end();
    });
});

test('inspect Pipfile', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('pipfile-pipapp');
      t.teardown(testUtils.activateVirtualenv('pip-app'));
    })
    .then(() => {
      return plugin.inspect('.', 'Pipfile');
    })
    .then(async (result) => {
      const plugin = result.plugin;
      const dependencyGraph = result.dependencyGraph;
      const pkg = await depGraphLib.legacy.graphToDepTree(
        dependencyGraph,
        'pip'
      );

      t.equal(plugin.targetFile, 'Pipfile', 'Pipfile targetfile');

      t.test('package dependencies', (t) => {
        t.notOk(pkg.dependencies['django'], 'django skipped (editable)');

        t.match(
          pkg.dependencies['django-select2'],
          {
            name: 'django-select2',
            version: '6.0.1',
            dependencies: {
              'django-appconf': {
                name: 'django-appconf',
              },
            },
          },
          'django-select2 looks ok'
        );

        t.match(
          pkg.dependencies['python-etcd'],
          {
            name: 'python-etcd',
            version: /^0\.4.*$/,
          },
          'python-etcd looks ok'
        );

        t.notOk(
          pkg.dependencies['e1839a8'],
          'dummy local package skipped (editable)'
        );

        t.ok(pkg.dependencies['jinja2'] !== undefined, 'jinja2 found');
        t.ok(pkg.dependencies['testtools'] !== undefined, 'testtools found');

        t.end();
      });

      t.end();
    });
});

test('inspect Pipfile with pinned versions', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('pipfile-pipapp-pinned');
      t.teardown(testUtils.activateVirtualenv('pip-app'));
    })
    .then(() => {
      return plugin.inspect('.', 'Pipfile');
    })
    .then(async (result) => {
      const dependencyGraph = result.dependencyGraph;
      const pkg = await depGraphLib.legacy.graphToDepTree(
        dependencyGraph,
        'pip'
      );

      t.test('package dependencies', (t) => {
        Object.keys(pipfilePinnedExpectedDependencies).forEach((depName) => {
          t.match(
            pkg.dependencies[depName],
            pipfilePinnedExpectedDependencies[depName].data,
            pipfilePinnedExpectedDependencies[depName].msg
          );
        });

        t.end();
      });

      t.end();
    });
});

const pipenvAppExpectedDependencies = {
  'python-etcd': {
    data: {
      name: 'python-etcd',
      version: /^0\.4/,
    },
    msg: 'python-etcd1 found with version >=0.4,<0.5',
  },
  jinja2: {
    data: {
      name: 'jinja2',
      version: /^0|1|2|3\.[0-9]/,
    },
    msg: 'jinja2 found',
  },
  testtools: {
    data: {
      name: 'testtools',
    },
    msg: 'testtools found',
  },
};

test('inspect Pipfile in nested directory', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('pipfile-nested-dirs');
      t.teardown(testUtils.activateVirtualenv('pip-app'));
    })
    .then(() => {
      return plugin.inspect('.', 'nested/directory/Pipfile');
    })
    .then(async (result) => {
      const plugin = result.plugin;
      const dependencyGraph = result.dependencyGraph;
      const pkg = await depGraphLib.legacy.graphToDepTree(
        dependencyGraph,
        'pip'
      );

      t.equal(
        plugin.targetFile,
        'nested/directory/Pipfile',
        'Pipfile targetfile'
      );

      t.test('package dependencies', (t) => {
        t.notOk(pkg.dependencies['django'], 'django skipped (editable)');

        t.match(
          pkg.dependencies['django-select2'],
          {
            name: 'django-select2',
            version: '6.0.1',
            dependencies: {
              'django-appconf': {
                name: 'django-appconf',
              },
            },
          },
          'django-select2 looks ok'
        );

        t.match(
          pkg.dependencies['python-etcd'],
          {
            name: 'python-etcd',
            version: /^0\.4.*$/,
          },
          'python-etcd looks ok'
        );

        t.notOk(
          pkg.dependencies['e1839a8'],
          'dummy local package skipped (editable)'
        );

        t.ok(pkg.dependencies['jinja2'] !== undefined, 'jinja2 found');
        t.ok(pkg.dependencies['testtools'] !== undefined, 'testtools found');

        t.end();
      });

      t.end();
    });
});

test('package names with urls are skipped', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('pip-app-deps-with-urls');
      const venvCreated = testUtils.ensureVirtualenv('pip-app-deps-with-urls');
      t.teardown(testUtils.activateVirtualenv('pip-app-deps-with-urls'));
      if (venvCreated) {
        testUtils.pipInstall();
      }
    })
    .then(() => {
      return plugin.inspect('.', 'requirements.txt');
    })
    .then(async (result) => {
      const dependencyGraph = result.dependencyGraph;
      const pkg = await depGraphLib.legacy.graphToDepTree(
        dependencyGraph,
        'pip'
      );
      t.equal(
        Object.keys(pkg.dependencies).length,
        1,
        '1 dependency was skipped'
      );
    });
});

test('inspect Pipfile with no deps or dev-deps exits with message', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('pipfile-empty');
      t.teardown(testUtils.activateVirtualenv('pip-app'));
    })
    .then(() => {
      return plugin.inspect('.', 'Pipfile');
    })
    .catch((error) => {
      t.match(
        normalize(error.message),
        'No dependencies detected in manifest.'
      );
    });
});

test('inspect pipenv app dev dependencies', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('pipenv-app');

      const venvCreated = testUtils.ensureVirtualenv('pipenv-app');
      t.teardown(testUtils.activateVirtualenv('pipenv-app'));
      if (venvCreated) {
        return testUtils.pipenvInstall({ dev: true });
      }
    })
    .then(() => {
      return plugin.inspect('.', 'Pipfile', {
        dev: true,
      });
    })
    .then(async (result) => {
      const dependencyGraph = result.dependencyGraph;
      const pkg = await depGraphLib.legacy.graphToDepTree(
        dependencyGraph,
        'pip'
      );

      t.test('package dependencies', (t) => {
        Object.keys(pipenvAppExpectedDependencies).forEach((depName) => {
          t.match(
            pkg.dependencies[depName],
            pipenvAppExpectedDependencies[depName].data,
            pipenvAppExpectedDependencies[depName].msg
          );
        });

        t.match(pkg.dependencies.bs4, { name: 'bs4' });

        t.end();
      });

      t.end();
    });
});

test('inspect pipenv app with auto-created virtualenv', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('pipenv-app');

      // Use several teardown callbacks, called in reverse order.
      const teardowns = [];
      t.teardown(() => {
        while (teardowns.length > 0) {
          teardowns.pop()();
        }
      });

      if (testUtils.getActiveVenvName() !== null) {
        teardowns.push(testUtils.deactivateVirtualenv());
      }

      // Set the WORKON_HOME env var to make pipenv put its auto-created
      // virtualenv where we want it.
      teardowns.push(testUtils.setWorkonHome());

      // Have pipenv create and update a virtualenv if it doesn't exist.
      const proc = subProcess.executeSync('pipenv', ['--venv']);
      if (proc.status !== 0) {
        teardowns.push(() => {
          fs.unlinkSync('Pipfile.lock');
        });
        const updateProc = subProcess.executeSync('pipenv', ['update']);
        if (updateProc.status !== 0) {
          t.bailout('Failed to install dependencies using `pipenv update`');
        }
      }
    })
    .then(() => {
      return plugin.inspect('.', 'Pipfile');
    })
    .then(async (result) => {
      const dependencyGraph = result.dependencyGraph;
      const pkg = await depGraphLib.legacy.graphToDepTree(
        dependencyGraph,
        'pip'
      );

      t.test('package dependencies', (t) => {
        Object.keys(pipenvAppExpectedDependencies).forEach((depName) => {
          t.match(
            pkg.dependencies[depName],
            pipenvAppExpectedDependencies[depName].data,
            pipenvAppExpectedDependencies[depName].msg
          );
        });

        t.end();
      });

      t.end();
    });
});

test('inspect pipenv app with user-created virtualenv', (t) => {
  return Promise.resolve()
    .then(() => {
      chdirWorkspaces('pipenv-app');

      const venvCreated = testUtils.ensureVirtualenv('pipenv-app');
      t.teardown(testUtils.activateVirtualenv('pipenv-app'));
      if (venvCreated) {
        return testUtils.pipenvInstall();
      }
    })
    .then(() => {
      return plugin.inspect('.', 'Pipfile');
    })
    .then(async (result) => {
      const dependencyGraph = result.dependencyGraph;
      const pkg = await depGraphLib.legacy.graphToDepTree(
        dependencyGraph,
        'pip'
      );

      t.test('package dependencies', (t) => {
        Object.keys(pipenvAppExpectedDependencies).forEach((depName) => {
          t.match(
            pkg.dependencies[depName],
            pipenvAppExpectedDependencies[depName].data,
            pipenvAppExpectedDependencies[depName].msg
          );
        });

        t.end();
      });

      t.end();
    });
});
