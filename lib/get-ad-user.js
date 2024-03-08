const { execSync } = require('child_process');

/**
 * 
 * @param {Object} adUserOptions
 * @param {"login" | "skole"} adUserOptions.domain
 * @param {"VTFK" | "VFYLKE" | "TFYLKE"} adUserOptions.countyOU
 * @param {"AUTO USERS" | "AUTO DISABLED USERS" | "MANUAL USERS"} adUserOptions.usersOU
 * @param {string} adUserOptions.filter e.g EmailAddress -eq "per.son@domain.no"
 * @param {string} adUserOptions.properties e.g UserPrincipalName, DisplayName, Department, Company
 * 
 */
module.exports.getAdUser = async (adUserOptions) => {
  const command = `Get-ADUser -SearchBase 'OU=${adUserOptions.usersOU},OU=USERS,OU=${adUserOptions.countyOU},DC=${adUserOptions.domain},DC=top,DC=no' -Filter '${adUserOptions.filter}' -Properties ${adUserOptions.properties}`
  const adUserResult = await execSync(command, { shell: 'powershell.exe' })
  console.log(adUserResult)
}