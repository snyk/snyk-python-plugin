var plugin = require('../lib');

function main() {
  var targetFile = process.argv[2];
  var root = process.argv[3] || '.';

  plugin.inspect(root, targetFile).then(function (result) {
    console.log(JSON.stringify(result, null, 2));
  }).catch(function (error) {
    console.log('Error:', error.stack);
  });

};

main();
