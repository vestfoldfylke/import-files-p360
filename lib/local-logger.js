const { spawn } = require("node:child_process");
const { createWriteStream, existsSync, mkdirSync } = require("node:fs");
const { dirname, join, resolve } = require("node:path");
const { Transform } = require("node:stream");

const ansiRegex = /\[[0-9;]*[A-Za-z]/g;

const createAnsiStripper = () => new Transform({
  transform(chunk, _encoding, callback) {
    callback(null, chunk.toString("utf8").replace(ansiRegex, ""));
  }
});

const findProjectRoot = (startDir) => {
  let current = startDir;
  while (true) {
    if (existsSync(join(current, "package.json"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`Could not locate project root (no package.json above ${startDir})`);
    }
    current = parent;
  }
};

function runWithLocalFileLog(scriptPath, scriptName) {

  const absoluteScriptPath = resolve(scriptPath);
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const projectRoot = findProjectRoot(__dirname);
  const logDir = join(projectRoot, "logs", scriptName);
  const logName = `${today.getFullYear()} - ${month}`
  const logPath = join(logDir, `${logName}.log`);

  mkdirSync(logDir, { recursive: true });

  const logStream = createWriteStream(logPath, { flags: "a" });

  const child = spawn(process.execPath, ["--env-file=.env", absoluteScriptPath], {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env
  });

  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  child.stdout.pipe(createAnsiStripper()).pipe(logStream, { end: false });
  child.stderr.pipe(createAnsiStripper()).pipe(logStream, { end: false });

  child.on("close", (code) => {
    logStream.end(() => process.exit(code ?? 0));
  });
}

module.exports = { runWithLocalFileLog };
