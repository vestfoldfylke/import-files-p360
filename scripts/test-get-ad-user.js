;(async () => {
  const path = require("node:path")
  const { existsSync } = require("node:fs")
  const { spawnSync } = require("node:child_process")
  const { logger } = require("@vestfoldfylke/loglady")
  const { getUnregAdUser } = require("../lib/get-ad-user")

  logger.logConfig({ prefix: "test-get-ad-user" })

  let failures = 0
  /**
   * @param {string} message
   * @param {...any} params
   */
  const fail = (message, ...params) => {
    failures++
    logger.error(message, ...params)
  }

  const scriptPath = path.join(__dirname, "..", "lib", "get-ad-user.ps1")
  logger.info("Steg 1: Sjekker at PowerShell-scriptet finnes på {ScriptPath}", scriptPath)
  if (!existsSync(scriptPath)) {
    fail("PS1-scriptet finnes ikke - kan ikke fortsette")
    process.exit(1)
  }
  logger.info("OK - PS1-scriptet finnes")

  logger.info("Steg 2: Sjekker at powershell.exe kan startes")
  const psProbe = spawnSync("powershell.exe", ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "$PSVersionTable.PSVersion.ToString()"], { encoding: "utf-8", windowsHide: true })
  if (psProbe.error || psProbe.status !== 0) {
    fail("powershell.exe kunne ikke startes: {Error}", psProbe.error?.message || psProbe.stderr?.trim() || `exit ${psProbe.status}`)
    process.exit(1)
  }
  logger.info("OK - PowerShell {Version} tilgjengelig", psProbe.stdout.trim())

  logger.info("Steg 3: Sjekker at ActiveDirectory-modulen er installert")
  const modProbe = spawnSync("powershell.exe", ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", 'if (Get-Module -ListAvailable ActiveDirectory) { "OK" } else { exit 1 }'], {
    encoding: "utf-8",
    windowsHide: true
  })
  if (modProbe.status !== 0) {
    fail("ActiveDirectory-modulen mangler - installer RSAT AD PowerShell")
    process.exit(1)
  }
  logger.info("OK - ActiveDirectory-modulen er tilgjengelig")

  logger.info("Steg 4: Verifiserer at regex-validering avviser skadelig input uten å kalle PowerShell")
  const injectionAttempts = ["victim@x.no'; whoami; #", 'victim@x.no" ; Start-Process cmd; #', "no-at-sign", "", "   ", `${"a".repeat(300)}@example.com`]
  for (const bad of injectionAttempts) {
    const result = await getUnregAdUser(bad)
    if (result === null) {
      logger.info("OK - avvist: {Input}", bad)
    } else {
      fail("FEIL - farlig input ble ikke avvist: {Input} -> {@Result}", bad, result)
    }
  }

  const testEmail = process.env.TEST_AD_EMAIL || process.argv[2]
  if (!testEmail) {
    logger.warn("Steg 5 hoppet over - sett TEST_AD_EMAIL i .env for å teste et reelt AD-oppslag")
  } else {
    logger.info("Steg 5: Reelt AD-oppslag for {Email}", testEmail)
    try {
      const user = await getUnregAdUser(testEmail)
      if (user) {
        logger.info("OK - fant bruker: DisplayName={DisplayName}, Company={Company}", user.DisplayName, user.Company)
      } else {
        logger.warn("Oppslag returnerte null - bruker ble ikke funnet i noen av OU-ene")
      }
    } catch (error) {
      logger.errorException(error, "FEIL - AD-oppslaget kastet")
      failures++
    }
  }

  logger.info("Steg 6: Oppslag av gyldig formatert e-post som (nesten helt sikkert) ikke finnes")
  try {
    const user = await getUnregAdUser("claude.finnes-ikke.ever.9f8a7b6c@vestfoldfylke.no")
    if (user === null) {
      logger.info("OK - returnerte null for ikke-eksisterende bruker")
    } else {
      logger.warn("Uventet: fant en bruker på probe-adressen (ikke feil, bare rart): {@User}", user)
    }
  } catch (error) {
    logger.errorException(error, "FEIL - probe-oppslaget kastet")
    failures++
  }

  if (failures > 0) {
    logger.error("Test avsluttet med {Failures} feil", failures)
    process.exit(1)
  }
  logger.info("Alle sjekker passerte")
})()
