const { existsSync, mkdirSync, appendFileSync } = require('fs')

const createLocalLogger = (scriptName) => {
  if (!existsSync('./logs')) mkdirSync('./logs')
  const logDir = `./logs/${scriptName}`
  if (!existsSync(logDir)) mkdirSync(logDir)
  const today = new Date()
  const month = today.getMonth() + 1 > 9 ? `${today.getMonth() + 1}` : `0${today.getMonth() + 1}`
  const logName = `${today.getFullYear()} - ${month}`

  const localLogger = (entry) => {
    console.log(entry)
    appendFileSync(`${logDir}/${logName}.log`, `${entry}\n`)
  }

  return localLogger
}

module.exports = { createLocalLogger }
