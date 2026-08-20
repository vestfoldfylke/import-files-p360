/**
 * @param {unknown} err
 * @returns {string}
 */
const formatError = (err) => {
  if (err instanceof Error) return err.stack || err.message
  return String(err)
}

module.exports = { formatError }
