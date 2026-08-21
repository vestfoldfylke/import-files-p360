const { spawnSync } = require("node:child_process")
const path = require("node:path")
const { UNREGISTERED } = require("../config")
const { logger } = require("@vestfoldfylke/loglady")

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/
const EMAIL_MAX_LENGTH = 254
const SCRIPT_PATH = path.join(__dirname, "get-ad-user.ps1")

/**
 * @param {{ email: string, countyOU: "VFYLKE" | "TFYLKE" }} param0
 */
const runLookup = ({ email, countyOU }) => {
  const result = spawnSync(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", SCRIPT_PATH, "-Email", email, "-UsersOU", "AUTO USERS", "-CountyOU", countyOU, "-Domain", "login"],
    { encoding: "utf-8", windowsHide: true }
  )

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`PowerShell exited with ${result.status}: ${result.stderr?.trim() || "no stderr"}`)
  }

  const stdout = result.stdout?.trim() ?? ""
  if (stdout.length === 0) {
    return null
  }
  return JSON.parse(stdout)
}

/**
 * @param {unknown} email
 */
const getUnregAdUser = (email) => {
  if (typeof email !== "string" || email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    logger.warn("Refusing AD lookup for invalid email {Email}", String(email))
    return null
  }

  const countyOU = UNREGISTERED.AD_MAIN_COUNTY_OU
  if (countyOU !== "VFYLKE" && countyOU !== "TFYLKE") {
    throw new Error(`UNREGISTERED_AD_MAIN_COUNTY_OU must be "VFYLKE" or "TFYLKE", got "${countyOU}"`)
  }

  logger.info("Looking for {Email} in OU {Ou}", email, countyOU)
  const adUser = runLookup({ email, countyOU })
  if (adUser && Array.isArray(adUser)) {
    logger.warn("Found several users in AD ({Ou}) with email {Email}, returning the first one - but should probably be checked", countyOU, email)
    return adUser[0]
  }
  if (adUser) {
    logger.info("Found user {Email} in OU {Ou}", email, countyOU)
    return adUser
  }

  logger.info("Could not find {Email} in AD, returning null", email)
  return null
}

module.exports = { getUnregAdUser }
