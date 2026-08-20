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
  if (!STATISTICS.URL || !STATISTICS.KEY) throw new Error('STATISTICS_URL and STATISTICS_KEY must be set')
  const payload = {
    system: 'import-files-p360',
    engine: `${name} ${version}`,
    company: stat.company,
    description: stat.description,
    type: stat.type,
    documentTitle: stat.documentTitle
  }

  const response = await fetch(`${STATISTICS.URL}/Stats`, {
    method: 'POST',
    headers: {
      'x-functions-key': STATISTICS.KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Stats call failed: ${response.status} ${response.statusText} - ${body}`)
  }

  return response.json()
}

module.exports = { createStat }