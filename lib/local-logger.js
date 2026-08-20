const { spawn } = require("node:child_process");
const { mkdirSync, openSync, existsSync } = require("node:fs");
const { dirname, resolve } = require("node:path");

function runWithLocalFileLog(scriptPath, scriptName) {

  const absoluteScriptPath = resolve(scriptPath);
  const today = new Date()
  const month = today.getMonth() + 1 > 9 ? `${today.getMonth() + 1}` : `0${today.getMonth() + 1}`
  const logDir = `./logs/${scriptName}`
  const logName = `${today.getFullYear()} - ${month}`
  const logPath = `${logDir}/${logName}.log`;

  if (!existsSync(logDir)) {
    mkdirSync(logDir);
  }

  const fileDescriptor = openSync(logPath, "a");

  const child = spawn(process.execPath, [absoluteScriptPath], {
    stdio: ["ignore", fileDescriptor, fileDescriptor],
    cwd: dirname(absoluteScriptPath),
    env: process.env
  });

  child.on("exit", (code) => process.exit(code ?? 0));
}

module.exports = { runWithLocalFileLog };
