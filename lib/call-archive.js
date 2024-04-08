const { ARCHIVE } = require('../config')
const axios = require('axios').default
const { getEntraIdToken } = require('./get-entraid-token')

module.exports.callArchive = async (endpoint, payload) => {
  const accessToken = await getEntraIdToken(ARCHIVE.SCOPE)
  const { data } = await axios.post(`${ARCHIVE.URL}/${endpoint}`, payload, { headers: { Authorization: `Bearer ${accessToken}` } })
  return data
}
