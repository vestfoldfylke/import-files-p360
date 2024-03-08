const { execSync } = require('child_process');

/**
 * 
 * @param {Object} adUserOptions
 * @param {"login" | "skole"} adUserOptions.domain
 * @param {"VTFK" | "VFYLKE" | "TFYLKE"} adUserOptions.countyOU
 * @param {"AUTO USERS" | "AUTO DISABLED USERS" | "MANUAL USERS"} adUserOptions.usersOU
 * @param {string} adUserOptions.filter
 * @param {string} adUserOptions.properties
 * 
 */
module.exports.getAdUser = async (adUserOptions) => {
  const command = `Get-ADUser -SearchBase "OU=${adUserOptions.usersOU},OU=${adUserOptions.countyOU},DC=top,DC=no" -Server ${adUserOptions.domain} -Filter ${adUserOptions.filter} -Properties ${adUserOptions.properties} | Select-Object (${adUserOptions.properties} | Sort-Object)`
  const adUserResult = await execSync(command, { shell: 'powershell.exe' })
  console.log(adUserResult)
}