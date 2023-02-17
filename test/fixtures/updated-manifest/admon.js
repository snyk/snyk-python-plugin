#!/usr/bin/env node
const { spawn } = require("child_process");
const [, , firstArg, ...args] = process.argv;

if (/pip_resolve.py$/.test(firstArg)) {
  console.log(111);
  // console.log the result from isolated build
} else {
  const proc = spawn("python", [firstArg, ...args], { shell: true });
  proc.stdout.on("data", data => console.log(data.toString()));
  proc.stderr.on("data", data => console.error(data.toString()));
  proc.on("close", code => process.exit(code));
}
