const { ARCHIVE } = require('../config')
const axios = require('axios').default
const getAccessToken = require('./get-entraid-token')

module.exports.callArchive = async (endpoint, payload) => {
  const accessToken = await getAccessToken(ARCHIVE.API_SCOPE)
  const { data } = await axios.post(`${ARCHIVE.URL}/${endpoint}`, payload, { headers: { Authorization: `Bearer ${accessToken}` } })
  return data
}
