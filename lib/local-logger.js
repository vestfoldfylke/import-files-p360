const { createWriteStream, mkdirSync } = require("node:fs")
const { basename, join } = require("node:path")

// 1. Identify what task file is actually running right now
const scriptPath = process.argv[1] || __filename
const scriptName = basename(scriptPath, ".js")

const today = new Date()
const month = String(today.getMonth() + 1).padStart(2, "0")

// 2. Set up paths relative to the current execution directory
const logDir = join(__dirname, "..", "logs", scriptName)
const logName = `${today.getFullYear()} - ${month}.log`
const logPath = join(logDir, logName)

try {
  mkdirSync(logDir, { recursive: true })
  const logStream = createWriteStream(logPath, { flags: "a" })

  // biome-ignore lint/suspicious/noControlCharactersInRegex: This regex is used to match ANSI escape codes
  const ansiRegex = /\[[0-9;]*[A-Za-z]/g

  /**
   * @param {string | Uint8Array} chunk
   * @returns {string}
   */
  const cleanChunk = (chunk) => {
    if (!chunk) {
      return ""
    }
    const str = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8")
    return str.replace(ansiRegex, "")
  }

  // 3. Stash the original native stream actions safely
  const originalStdoutWrite = process.stdout.write.bind(process.stdout)
  const originalStderrWrite = process.stderr.write.bind(process.stderr)

  // 4. Overwrite stdout & stderr so console.log, console.error, and library logs get recorded
  process.stdout.write = /** @type {typeof process.stdout.write} */ (
    (chunk, encoding, callback) => {
      logStream.write(cleanChunk(chunk))
      return originalStdoutWrite(chunk, encoding, callback)
    }
  )

  process.stderr.write = /** @type {typeof process.stderr.write} */ (
    (chunk, encoding, callback) => {
      logStream.write(cleanChunk(chunk))
      return originalStderrWrite(chunk, encoding, callback)
    }
  )

  // Close the file stream cleanly when Node exits
  process.on("exit", () => {
    logStream.end()
  })
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(`Logger interceptor crashed: ${message}\n`)
}
