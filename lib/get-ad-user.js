const { execSync } = require('child_process');
const { UNREGISTERED } = require('../config');
const { logger } = require('@vtfk/logger');

/**
 * 
 * @param {Object} adUserOptions
 * @param {"login" | "skole"} adUserOptions.domain
 * @param {"VTFK" | "VFYLKE" | "TFYLKE"} adUserOptions.countyOU
 * @param {"AUTO USERS" | "AUTO DISABLED USERS" | "MANUAL USERS"} adUserOptions.usersOU
 * @param {string} adUserOptions.filter e.g EmailAddress -eq "per.son@domain.no"
 * @param {string} adUserOptions.properties e.g UserPrincipalName, DisplayName, Department, Company
 * @returns {Object} adUser(s) with the properties you asked for
 * 
 */
const getAdUser = async (adUserOptions) => {
  const command = `Get-ADUser -SearchBase 'OU=${adUserOptions.usersOU},OU=USERS,OU=${adUserOptions.countyOU},DC=${adUserOptions.domain},DC=top,DC=no' -Filter '${adUserOptions.filter}' -Properties ${adUserOptions.properties} | Select-Object -Property ${adUserOptions.properties} | ConvertTo-Json -Depth 20`
  const quoteCommand = command.replaceAll('"', '\\"')
  const cmd = `cmd.exe /c chcp 65001>nul && powershell.exe -NoLogo -ExecutionPolicy ByPass -Command "${quoteCommand}"`
  const adUserResult = await execSync(cmd, { encoding: 'utf-8' })
  if (adUserResult.length < 2) return null
  const adUser = JSON.parse(adUserResult)
  return adUser
}

const getUnregAdUser = async (email) => {
  const adUserOptions = {
    countyOU: UNREGISTERED.AD_MAIN_COUNTY_OU, // First, we try in main OU (VFYLKE or TFYLKE)
    domain: "login",
    usersOU: "AUTO USERS",
    filter: `Email -eq "${email}"`,
    properties: "DisplayName, Company"
  }
  logger('info', [`Looking for ${email} in OU`, UNREGISTERED.AD_MAIN_COUNTY_OU])
  let adUser = await getAdUser(adUserOptions)
  if (adUser && Array.isArray(adUser)) {
    logger('warn', [`Found several users in AD (${UNREGISTERED.AD_MAIN_COUNTY_OU}) with email ${email}, returning the first one - but should probably be checked`])
    return adUser[0]
  }
  if (adUser) {
    logger('info', [`Found user ${email} in OU`, UNREGISTERED.AD_MAIN_COUNTY_OU])
    return adUser
  }
  adUserOptions.countyOU = "VTFK"
  logger('info', [`Looking for ${email} in OU`, 'VTFK'])
  adUser = await getAdUser(adUserOptions)
  if (adUser && Array.isArray(adUser)) {
    logger('warn', [`Found several users in AD (VTFK) with email ${email}, returning the first one - but should probably be checked`])
    return adUser[0]
  }
  if (adUser) {
    logger('info', [`Found user ${email} in OU`, 'VTFK'])
    return adUser
  }
  logger('info', [`Could not find ${email} in AD, returning null`])
  return null
}

module.exports = { getAdUser, getUnregAdUser }