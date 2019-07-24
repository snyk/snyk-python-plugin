/* eslint-disable no-console */
const plugin = require('../lib');

function main() {
  const targetFile = process.argv[2];
  const root = process.argv[3] || '.';

  plugin
    .inspect(root, targetFile)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.log('Error:', error.stack);
    });
}

main();
