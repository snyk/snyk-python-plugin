var path = require('path');
var subProcess = require('./sub-process');

module.exports = {
  inspect: inspect,
};

function inspect(root, targetFile, args) {
  return Promise.all([
    getMetaData(),
    getDependencies(root, targetFile, args),
  ])
  .then(function (result) {
    return {
      plugin: result[0],
      package: result[1],
    };
  });
}

function getMetaData() {
  return subProcess.execute('python', ['--version'])
  .then(function(res) {
    return {
      name: 'snyk-python-plugin',
      runtime: res.stdout || res.stderr, // `python --version` sends to stderr
    };
  });
}

function getDependencies(root, targetFile, args) {
  return subProcess.execute(
    'python',
    buildArgs(root, targetFile, args),
    { cwd: root }
  )
  .then(function (result) {
    return JSON.parse(result.stdout);
  })
  .catch(function (stderr) {
    if (typeof stderr === 'string' &&
      stderr.indexOf('Required package missing') !== -1) {
      throw new Error('Please run `pip install -r ' + targetFile + '`');
    } else {
      throw new Error(stderr);
    }
  });
}

function buildArgs(root, targetFile, extraArgs) {
  var args = [path.resolve(__dirname, '../plug/pip_resolve.py')];
  if (targetFile) { args.push(targetFile); }
  if (extraArgs) { args.push(extraArgs); }
  return args;
}
