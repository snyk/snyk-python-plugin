var childProcess = require('child_process');

var _makeSpawnOptions = function(options) {
  var spawnOptions = {shell: true};
  if (options && options.cwd) {
    spawnOptions.cwd = options.cwd;
  }
  if (options && options.env) {
    spawnOptions.env = options.env;
  }
  return spawnOptions;
};

module.exports.execute = function (command, args, options) {
  var spawnOptions = _makeSpawnOptions(options);

  return new Promise(function (resolve, reject) {
    var stdout = '';
    var stderr = '';

    var proc = childProcess.spawn(command, args, spawnOptions);
    proc.stdout.on('data', function (data) {
      stdout = stdout + data;
    });
    proc.stderr.on('data', function (data) {
      stderr = stderr + data;
    });

    proc.on('close', function (code) {
      if (code !== 0) {
        return reject(stdout || stderr);
      }
      resolve(stdout || stderr);
    });
  });
};

module.exports.executeSync = function (command, args, options) {
  var spawnOptions = _makeSpawnOptions(options);

  return childProcess.spawnSync(command, args, spawnOptions);
};
