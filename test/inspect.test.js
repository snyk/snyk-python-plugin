var test = require('tap').test;
var fs = require('fs');
var path = require('path');
var process = require('process');
var sinon = require('sinon');

var plugin = require('../lib');
var subProcess = require('../lib/sub-process');
var testUtils = require('./test-utils');
var os = require('os');

function normalize(s) {
  return s.replace(/\r/g, '');
}

test('install requirements in "pip-app" venv (may take a while)', function (t) {
  chdirWorkspaces('pip-app');
  testUtils.ensureVirtualenv('pip-app');
  t.teardown(testUtils.activateVirtualenv('pip-app'));
  try {
    testUtils.pipInstall();
    t.pass('installed pip packages');
    t.end();
  } catch (error) {
    t.bailout(error);
  }
});

var pipAppExpectedDependencies = {
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
        'pbr': {},
        'extras': {},
        'fixtures': {},
        'unittest2': {},
        'traceback2': {},
        'python-mimeparse': {},
      },
    },
    msg: 'testtools ok, even though it\'s cyclic, yay!',
  },
};

test('inspect', function (t) {
  return Promise.resolve().then(function () {
    chdirWorkspaces('pip-app');
    t.teardown(testUtils.activateVirtualenv('pip-app'));
  })
    .then(function () {
      return plugin.inspect('.', 'requirements.txt');
    })
    .then(function (result) {
      var plugin = result.plugin;
      var pkg = result.package;

      t.test('plugin', function (t) {
        t.ok(plugin, 'plugin');
        t.equal(plugin.name, 'snyk-python-plugin', 'name');
        t.match(plugin.runtime, 'Python', 'runtime');
        t.notOk(plugin.targetFile, 'no targetfile for requirements.txt');
        t.end();
      });

      t.test('package', function (t) {
        t.ok(pkg, 'package');
        t.equal(pkg.name, 'pip-app', 'name');
        t.equal(pkg.version, '0.0.0', 'version');
        t.end();
      });

      t.test('package dependencies', function (t) {
        Object.keys(pipAppExpectedDependencies).forEach(function (depName) {
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

test('transitive dep not installed', function (t) {
  return Promise.resolve().then(function () {
    chdirWorkspaces('pip-app');
    var venvCreated = testUtils.ensureVirtualenv('pip-app-without-markupsafe');
    t.teardown(testUtils.activateVirtualenv('pip-app-without-markupsafe'));
    if (venvCreated) {
      testUtils.pipInstall();
      testUtils.pipUninstall('MarkupSafe');
    }
  })
    .then(function () {
      return plugin.inspect('.', 'requirements.txt')
        .then(function () {
          t.fail('should have failed');
        })
        .catch(function (error) {
          t.equal(normalize(error.message),
            'Required packages missing: markupsafe\n\nPlease run `pip install -r requirements.txt`');
          t.end();
        });
    });
});

test('transitive dep not installed, but with allowMissing option',
  function (t) {
    return Promise.resolve().then(function () {
      chdirWorkspaces('pip-app');
      var venvCreated =
        testUtils.ensureVirtualenv('pip-app-without-markupsafe');
      t.teardown(testUtils.activateVirtualenv('pip-app-without-markupsafe'));
      if (venvCreated) {
        testUtils.pipInstall();
        testUtils.pipUninstall('MarkupSafe');
      }
    })
      .then(function () {
        return plugin.inspect('.', 'requirements.txt', {allowMissing: true});
      })
      .then(function (result) {
        var plugin = result.plugin;
        var pkg = result.package;

        t.test('plugin', function (t) {
          t.ok(plugin, 'plugin');
          t.equal(plugin.name, 'snyk-python-plugin', 'name');
          t.match(plugin.runtime, 'Python', 'runtime');
          t.end();
        });

        t.test('package', function (t) {
          t.ok(pkg, 'package');
          t.equal(pkg.name, 'pip-app', 'name');
          t.equal(pkg.version, '0.0.0', 'version');
          t.end();
        });

        t.test('package dependencies', function (t) {
          t.same(pkg.dependencies.django, {
            name: 'django',
            version: '1.6.1',
          }, 'django looks ok');

          t.match(pkg.dependencies.jinja2, {
            name: 'jinja2',
            version: '2.7.2',
            dependencies: {},
          }, 'jinja2 looks ok');

          t.match(pkg.dependencies['python-etcd'], {
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
          }, 'python-etcd is ok');

          t.match(pkg.dependencies['django-select2'], {
            name: 'django-select2',
            version: '6.0.1',
            dependencies: {
              'django-appconf': {
                name: 'django-appconf',
              },
            },
          }, 'django-select2 looks ok');

          t.end();
        });

        t.end();
      });
  });

test('deps not installed', function (t) {
  return Promise.resolve().then(function () {
    chdirWorkspaces('pip-app-deps-not-installed');
    t.teardown(testUtils.activateVirtualenv('pip-app'));
  })
    .then(function () {
      return plugin.inspect('.', 'requirements.txt');
    })
    .then(function () {
      t.fail('should have failed');
    })
    .catch(function (error) {
      t.equal(normalize(error.message), 'Required packages missing: awss\n\nPlease run `pip install -r requirements.txt`');
      t.end();
    });
});

test('deps not installed, but with allowMissing option', function (t) {
  return Promise.resolve().then(function () {
    chdirWorkspaces('pip-app-deps-not-installed');
    t.teardown(testUtils.activateVirtualenv('pip-app'));
  })
    .then(function () {
      return plugin.inspect('.', 'requirements.txt', {allowMissing: true});
    })
    .then(function (result) {
      var plugin = result.plugin;
      var pkg = result.package;

      t.test('plugin', function (t) {
        t.ok(plugin, 'plugin');
        t.equal(plugin.name, 'snyk-python-plugin', 'name');
        t.match(plugin.runtime, 'Python', 'runtime');
        t.end();
      });

      t.test('package', function (t) {
        t.ok(pkg, 'package');
        t.equal(pkg.name, 'pip-app-deps-not-installed', 'name');
        t.equal(pkg.version, '0.0.0', 'version');
        t.end();
      });

      t.end();
    });
});

test('uses provided exec command', function (t) {
  return Promise.resolve().then(function () {
    var execute = sinon.stub(subProcess, 'execute');
    execute.onFirstCall().returns(Promise.resolve('abc'));
    execute.onSecondCall().returns(Promise.resolve('{}'));
    t.teardown(execute.restore);
    return execute;
  })
    .then(function (execute) {
      var command = 'echo';
      return plugin.inspect('.', 'requirements.txt', {command: command})
        .then(function () {
          t.ok(execute.calledTwice, 'execute called twice');
          t.equal(execute.firstCall.args[0], command, 'uses command');
          t.equal(execute.secondCall.args[0], command, 'uses command');
          t.end();
        });
    });
});

test('package name differs from requirement (- vs _)', function (t) {
  return Promise.resolve().then(function () {
    chdirWorkspaces('pip-app-deps-with-dashes');
    var venvCreated = testUtils.ensureVirtualenv('pip-app-deps-with-dashes');
    t.teardown(testUtils.activateVirtualenv('pip-app-deps-with-dashes'));
    if (venvCreated) {
      testUtils.pipInstall();
    }
  })
    .then(function () {
      return plugin.inspect('.', 'requirements.txt', {allowMissing: true});
    })
    .then(function (result) {
      var pkg = result.package;
      t.same(pkg.dependencies['dj-database-url'], {
        name: 'dj-database-url',
        version: '0.4.2',
      }, 'dj-database-url looks ok');
      if (os.platform() !== 'win32') {
        t.same(pkg.dependencies['posix-ipc'], {
          name: 'posix-ipc',
          version: '1.0.0',
        }, 'posix-ipc looks ok');
      }
      t.end();
    });
});

test('package name differs from requirement (- vs .)', function (t) {
  t.pass('Not implemented yet');
  t.end();
});

test('package installed conditionally based on python version', function (t) {
  return Promise.resolve().then(function () {
    chdirWorkspaces('pip-app-with-python-markers');
    var venvCreated = testUtils.ensureVirtualenv('pip-app-with-python-markers');
    t.teardown(testUtils.activateVirtualenv('pip-app-with-python-markers'));
    if (venvCreated) {
      testUtils.pipInstall();
    }
  })
    .then(function () {
      return plugin.inspect('.', 'requirements.txt');
    })
    .then(function (result) {
      var pkg = result.package;
      t.notOk(pkg.dependencies.enum34, 'enum34 dep ignored');
      t.end();
    });
});

test('Pipfile package found conditionally based on python version', function (t) {
  return Promise.resolve().then(function () {
    chdirWorkspaces('pipfile-markers');
    t.teardown(testUtils.activateVirtualenv('pip-app'));
  })
    .then(function () {
      return plugin.inspect('.', 'Pipfile');
    })
    .then(function (result) {
      var pkg = result.package;
      t.notOk(pkg.dependencies.black, 'black dep ignored');
      t.notOk(pkg.dependencies.stdeb, 'stdeb dep ignored');

      t.end();
    });
});

test('package depends on platform', function (t) {
  return Promise.resolve().then(function () {
    chdirWorkspaces('pip-app-deps-conditional');
    var venvCreated = testUtils.ensureVirtualenv('pip-app-deps-conditional');
    t.teardown(testUtils.activateVirtualenv('pip-app-deps-conditional'));
    if (venvCreated) {
      testUtils.pipInstall();
    }
  })
    .then(function () {
      return plugin.inspect('.', 'requirements.txt', {allowMissing: true});
    })
    .then(function (result) {
      var pkg = result.package;
      if (os.platform() !== 'win32') {
        t.notOk(pkg.dependencies.pypiwin32, 'win32 dep ignored');
        t.same(pkg.dependencies['posix-ipc'], {
          name: 'posix-ipc',
          version: '1.0.0',
        }, 'posix-ipc looks ok');
      } else {
        t.ok(pkg.dependencies.pypiwin32, 'win32 installed');
        t.notOk(pkg.dependencies['posix-ipc'], 'not win32 dep skipped');
      }
      t.end();
    });
});

test('editables ignored', function (t) {
  return Promise.resolve().then(function () {
    chdirWorkspaces('pip-app-deps-editable');
    var venvCreated = testUtils.ensureVirtualenv('pip-app-deps-editable');
    t.teardown(testUtils.activateVirtualenv('pip-app-deps-editable'));
    if (venvCreated) {
      testUtils.pipInstall();
    }
  })
    .then(function () {
      return plugin.inspect('.', 'requirements.txt', {allowMissing: true});
    })
    .then(function (result) {
      var pkg = result.package;
      t.notOk(pkg.dependencies['simple'], 'editable dep ignored');
      t.notOk(pkg.dependencies['sample'], 'editable subdir dep ignored');
      if (os.platform() !== 'win32') {
        t.same(pkg.dependencies['posix-ipc'], {
          name: 'posix-ipc',
          version: '1.0.0',
        }, 'posix-ipc looks ok');
      }
      t.end();
    });
});

test('deps with options', function (t) {
  return Promise.resolve().then(function () {
    chdirWorkspaces('pip-app-with-options');
    var venvCreated = testUtils.ensureVirtualenv('pip-app-with-options');
    t.teardown(testUtils.activateVirtualenv('pip-app-with-options'));
    if (venvCreated) {
      testUtils.pipInstall();
    }
  })
    .then(function () {
      return plugin.inspect('.', 'requirements.txt');
    })
    .then(function (result) {
      var plugin = result.plugin;
      var pkg = result.package;

      t.test('plugin', function (t) {
        t.ok(plugin, 'plugin');
        t.equal(plugin.name, 'snyk-python-plugin', 'name');
        t.match(plugin.runtime, 'Python', 'runtime');
        t.end();
      });

      t.test('package', function (t) {
        t.ok(pkg, 'package');
        t.equal(pkg.name, 'pip-app-with-options', 'name');
        t.equal(pkg.version, '0.0.0', 'version');
        t.end();
      });
      t.test('package dependencies', function (t) {
        t.match(pkg.dependencies.markupsafe, {
          name: 'markupsafe',
          version: '1.0',
        }, 'MarkupSafe looks ok');

        t.match(pkg.dependencies.dnspython, {
          name: 'dnspython',
          version: '1.13.0',
        }, 'dnspython looks ok');

        t.end();
      });

      t.end();
    });
});

test('trusted host ignored', function (t) {
  return Promise.resolve().then(function () {
    chdirWorkspaces('pip-app-trusted-host');
    var venvCreated = testUtils.ensureVirtualenv('pip-app-trusted-host');
    t.teardown(testUtils.activateVirtualenv('pip-app-trusted-host'));
    if (venvCreated) {
      testUtils.pipInstall();
    }
  })
    .then(function () {
      return plugin.inspect('.', 'requirements.txt');
    })
    .then(function (result) {
      t.ok(result.package.dependencies, 'does not error');
      t.end();
    });
});

test('inspect Pipfile', function (t) {
  return Promise.resolve().then(function () {
    chdirWorkspaces('pipfile-pipapp');
    t.teardown(testUtils.activateVirtualenv('pip-app'));
  })
    .then(function () {
      return plugin.inspect('.', 'Pipfile');
    })
    .then(function (result) {
      var plugin = result.plugin;
      var pkg = result.package;

      t.equal(plugin.targetFile, 'Pipfile', 'Pipfile targetfile');

      t.test('package dependencies', function (t) {
        t.notOk(pkg.dependencies['django'], 'django skipped (editable)');

        t.match(pkg.dependencies['django-select2'], {
          name: 'django-select2',
          version: '6.0.1',
          dependencies: {
            'django-appconf': {
              name: 'django-appconf',
            },
          },
        }, 'django-select2 looks ok');

        t.match(pkg.dependencies['python-etcd'], {
          name: 'python-etcd',
          version: /^0\.4.*$/,
        }, 'python-etcd looks ok');

        t.notOk(pkg.dependencies['e1839a8'],
          'dummy local package skipped (editable)');

        t.ok(pkg.dependencies['jinja2'] !== undefined, 'jinja2 found');
        t.ok(pkg.dependencies['testtools'] !== undefined, 'testtools found');

        t.end();
      });

      t.end();
    });
});

test('inspect Pipfile with pinned versions', function (t) {
  return Promise.resolve().then(function () {
    chdirWorkspaces('pipfile-pipapp-pinned');
    t.teardown(testUtils.activateVirtualenv('pip-app'));
  })
    .then(function () {
      return plugin.inspect('.', 'Pipfile');
    })
    .then(function (result) {
      var pkg = result.package;

      t.test('package dependencies', function (t) {
        Object.keys(pipAppExpectedDependencies).forEach(function (depName) {
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

var pipenvAppExpectedDependencies = {
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
      version: /^0|1|2\.[0-6]/,
    },
    msg: 'jinja2 found with version <2.7',
  },
  testtools: {
    data: {
      name: 'testtools',
    },
    msg: 'testtools found',
  },
};

test('inspect pipenv app with user-created virtualenv', function (t) {
  return Promise.resolve().then(function () {
    chdirWorkspaces('pipenv-app');

    var venvCreated = testUtils.ensureVirtualenv('pipenv-app');
    t.teardown(testUtils.activateVirtualenv('pipenv-app'));
    if (venvCreated) {
      return testUtils.pipenvInstall();
    }
  })
    .then(function () {
      return plugin.inspect('.', 'Pipfile');
    })
    .then(function (result) {
      var pkg = result.package;

      t.test('package dependencies', function (t) {
        Object.keys(pipenvAppExpectedDependencies).forEach(function (depName) {
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

test('inspect pipenv app with auto-created virtualenv', function (t) {
  return Promise.resolve().then(function () {
    chdirWorkspaces('pipenv-app');

    // Use several teardown callbacks, called in reverse order.
    var teardowns = [];
    t.teardown(function () {
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
    subProcess.executeSync('pip', ['install', 'pipenv']);
    var proc = subProcess.executeSync('pipenv', ['--venv']);
    if (proc.status !== 0) {
      teardowns.push(function () {
        fs.unlinkSync('Pipfile.lock');
      });
      var updateProc = subProcess.executeSync('pipenv', ['update']);
      if (updateProc.status !== 0) {
        t.bailout('Failed to install dependencies using `pipenv update`');
      }
    }
  })
    .then(function () {
      return plugin.inspect('.', 'Pipfile');
    })
    .then(function (result) {
      var pkg = result.package;

      t.test('package dependencies', function (t) {
        Object.keys(pipenvAppExpectedDependencies).forEach(
          function (depName) {
            t.match(
              pkg.dependencies[depName],
              pipenvAppExpectedDependencies[depName].data,
              pipenvAppExpectedDependencies[depName].msg
            );
          }
        );

        t.end();
      });

      t.end();
    });
});

test('inspect pipenv app dev dependencies', function (t) {
  return Promise.resolve().then(function () {
    chdirWorkspaces('pipenv-app');

    var venvCreated = testUtils.ensureVirtualenv('pipenv-app');
    t.teardown(testUtils.activateVirtualenv('pipenv-app'));
    if (venvCreated) {
      return testUtils.pipenvInstall();
    }
  })
    .then(function () {
      return plugin.inspect('.', 'Pipfile', {dev: true});
    })
    .then(function (result) {
      var pkg = result.package;

      t.test('package dependencies', function (t) {
        Object.keys(pipenvAppExpectedDependencies).forEach(function (depName) {
          t.match(
            pkg.dependencies[depName],
            pipenvAppExpectedDependencies[depName].data,
            pipenvAppExpectedDependencies[depName].msg
          );
        });

        t.match(pkg.dependencies.virtualenv, {name: 'virtualenv'});

        t.end();
      });

      t.end();
    });
});

test('package names with urls are skipped', function (t) {
  return Promise.resolve().then(function () {
    chdirWorkspaces('pip-app-deps-with-urls');
    var venvCreated = testUtils.ensureVirtualenv('pip-app-deps-with-urls');
    t.teardown(testUtils.activateVirtualenv('pip-app-deps-with-urls'));
    if (venvCreated) {
      testUtils.pipInstall();
    }
  })
    .then(function () {
      return plugin.inspect('.', 'requirements.txt');
    })
    .then(function (result) {
      var pkg = result.package;
      t.equal(Object.keys(pkg.dependencies).length, 1, '1 dependency was skipped');
    });
});

function chdirWorkspaces(dir) {
  process.chdir(path.resolve(__dirname, 'workspaces', dir));
}
