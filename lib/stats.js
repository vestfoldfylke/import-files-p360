const { default: axios } = require('axios')
const { STATISTICS } = require('../config')
const { name, version } = require('../package.json')

/**
 *
 * @param {Object} stat
 * @param {string} stat.company
 * @param {string} stat.description
 * @param {string} stat.type
 * @param {string} stat.documentTitle
 *
 */
const createStat = async (stat) => {
  if (!(stat.company && stat.description && stat.type)) throw new Error('Stat must include properties: company, description, type')
  const payload = {
    system: 'import-files-p360',
    engine: `${name} ${version}`,
    company: stat.company,
    description: stat.description,
    type: stat.type,
    documentTitle: stat.documentTitle
  }
  const { data } = await axios.post(`${STATISTICS.URL}/Stats`, payload, { headers: { 'x-functions-key': STATISTICS.KEY } })
  return data
}

module.exports = { createStat }
