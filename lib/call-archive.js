const { ARCHIVE } = require("../config")
const { getEntraIdToken } = require("./get-entraid-token")

/**
 *
 * @param {string} endpoint
 * @param {*} payload
 * @returns
 */
module.exports.callArchive = async (endpoint, payload) => {
  if (!ARCHIVE.URL || !ARCHIVE.SCOPE) {
    throw new Error("ARCHIVE env vars must be set: ARCHIVE_URL, ARCHIVE_SCOPE")
  }

  const accessToken = await getEntraIdToken(ARCHIVE.SCOPE)
  const url = `${ARCHIVE.URL}/${endpoint}`
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json"
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Archive call to ${endpoint} failed: ${response.status} ${response.statusText} - ${body}`)
  }

  return response.json()
}
