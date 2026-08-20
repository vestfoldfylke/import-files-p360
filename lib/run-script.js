const { basename } = require("node:path");
const { runWithLocalFileLog } = require("./local-logger");

const scriptFile = process.argv[2];
if (!scriptFile) {
  console.error("Usage: node lib/run-script.js <path-to-script>");
  process.exit(2);
}

runWithLocalFileLog(scriptFile, basename(scriptFile, ".js"));
