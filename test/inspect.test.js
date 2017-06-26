var test = require('tap').test;
var path = require('path');
var sinon = require('sinon');

var plugin = require('../lib');
var subProcess = require('../lib/sub-process');

test('install requirements (may take a while)', function (t) {
  chdirWorkspaces('pip-app');
  return subProcess.execute('pip',
    ['install', '-r', 'requirements.txt', '--disable-pip-version-check']
  )
  .then(function () {
    t.pass('installed pip packages');
  })
  .catch(function (error) {
    t.bailout(error);
  });
});

test('inspect', function (t) {
  chdirWorkspaces('pip-app');

  return plugin.inspect('.', 'requirements.txt')
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
      // t.equal(pkg.full, 'pip-app@0.0.0', 'full'); // do we need this?
      t.same(pkg.from, ['pip-app@0.0.0'], 'from self');
      t.end();
    });

    t.test('package dependencies', function (t) {
      t.same(pkg.dependencies.django, {
        name: 'django',
        version: '1.6.1',
        from: [
          'pip-app@0.0.0',
          'django@1.6.1',
        ],
      }, 'django looks ok');
      t.match(pkg.dependencies.jinja2, {
        name: 'jinja2',
        version: '2.7.2',
        from: [
          'pip-app@0.0.0',
          'jinja2@2.7.2',
        ],
        dependencies: {
          markupsafe: {
            from: [
              'pip-app@0.0.0',
              'jinja2@2.7.2',
              /markupsafe@.+$/,
            ],
            name: 'markupsafe',
            version: /.+$/,
          },
        },
      }, 'jinja2 looks ok');
      t.end();
    });

    t.end();
  });
});

test('deps not installed', function (t) {
  chdirWorkspaces('pip-app-deps-not-installed');
  return plugin.inspect('.', 'requirements.txt')
  .then(function () {
    t.fail('should have failed');
  })
  .catch(function (error) {
    t.equal(error.message, 'Please run `pip install -r requirements.txt`');
  });
});

test('uses provided exec command', function (t) {
  var command = 'echo';
  var execute = sinon.stub(subProcess, 'execute');
  execute.onFirstCall().returns(Promise.resolve('abc'));
  execute.onSecondCall().returns(Promise.resolve('{}'));
  t.teardown(execute.restore);

  return plugin.inspect('.', 'requirements.txt', {
    command: command,
  })
  .then(function () {
    t.ok(execute.calledTwice, 'execute called twice');
    t.equal(execute.firstCall.args[0], command, 'uses command');
    t.equal(execute.secondCall.args[0], command, 'uses command');
  });
});

test('package name differs from requirement', function (t) {
  chdirWorkspaces('pip-app-deps-with-dashes');
  return pipInstall()
  .then(function () {
    return plugin.inspect('.', 'requirements.txt')
    .then(function (result) {
      var pkg = result.package;
      t.same(pkg.dependencies['dj-database-url'], {
        from: [
          'pip-app-deps-with-dashes@0.0.0',
          'dj-database-url@0.4.2',
        ],
        name: 'dj-database-url',
        version: '0.4.2',
      }, 'dj-database-url looks ok');
      t.same(pkg.dependencies['posix-ipc'], {
        from: [
          'pip-app-deps-with-dashes@0.0.0',
          'posix-ipc@1.0.0',
        ],
        name: 'posix-ipc',
        version: '1.0.0',
      }, 'posix-ipc looks ok');
      t.end();
    });
  })
  .catch(function (error) {
    t.fail(error);
  });
});

test('package depends on platform', function (t) {
  chdirWorkspaces('pip-app-deps-conditional');
  return pipInstall()
  .then(function () {
    return plugin.inspect('.', 'requirements.txt')
    .then(function (result) {
      var pkg = result.package;
      t.notOk(pkg.dependencies.pypiwin32, 'win32 dep ignored');
      t.same(pkg.dependencies['posix-ipc'], {
        from: [
          'pip-app-deps-conditional@0.0.0',
          'posix-ipc@1.0.0',
        ],
        name: 'posix-ipc',
        version: '1.0.0',
      }, 'posix-ipc looks ok');
      t.end();
    });
  })
  .catch(function (error) {
    t.fail(error);
  });
});

test('editables ignored', function (t) {
  chdirWorkspaces('pip-app-deps-editable');
  return pipInstall()
  .then(function () {
    return plugin.inspect('.', 'requirements.txt')
    .then(function (result) {
      var pkg = result.package;
      t.notOk(pkg.dependencies['django-munigeo'], 'editable dep ignored');
      t.same(pkg.dependencies['posix-ipc'], {
        from: [
          'pip-app-deps-editable@0.0.0',
          'posix-ipc@1.0.0',
        ],
        name: 'posix-ipc',
        version: '1.0.0',
      }, 'posix-ipc looks ok');
      t.end();
    });
  })
  .catch(function (error) {
    t.fail(error);
  });
});

function pipInstall() {
  return subProcess.execute('pip',
    ['install', '-r', 'requirements.txt', '--disable-pip-version-check']);
}

function chdirWorkspaces(dir) {
  process.chdir(path.resolve(__dirname, 'workspaces', dir));
}
