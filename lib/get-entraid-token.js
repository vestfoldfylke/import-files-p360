const { APPREG } = require('../config')
const { FileCache } = require('./file-cache')
const { ConfidentialClientApplication } = require("@azure/msal-node")

const tokenCache = new FileCache('./.token-cache')

/**
 * @param {string} scope
 * @param {boolean} [forceNew]
 * @returns {Promise<string>}
 */
const getEntraIdToken = async (scope, forceNew = false) => {
  if (!APPREG.CLIENT_ID || !APPREG.CLIENT_SECRET || !APPREG.TENANT_ID) {
    throw new Error('APPREG env vars must be set: APPREG_CLIENT_ID, APPREG_CLIENT_SECRET, APPREG_TENANT_ID')
  }

  const cacheKey = `${scope}-token`

  const cachedToken = /** @type {string | null} */ (tokenCache.get(cacheKey))
  if (!forceNew && cachedToken) {
    return cachedToken.substring(0, cachedToken.length - 2)
  }

  const config = {
    auth: {
      clientId: APPREG.CLIENT_ID,
      authority: `https://login.microsoftonline.com/${APPREG.TENANT_ID}/`,
      clientSecret: APPREG.CLIENT_SECRET
    }
  }

  const cca = new ConfidentialClientApplication(config)
  const clientCredentials = {
    scopes: [scope]
  }

  const token = await cca.acquireTokenByClientCredential(clientCredentials)

  if (!token?.accessToken || !token.expiresOn) {
    throw new Error(`Failed to acquire token for scope: ${scope}`)
  }

  const expires = Math.floor((token.expiresOn.getTime() - Date.now()) / 1000)
  tokenCache.set(cacheKey, `${token.accessToken}==`, expires) // Haha, just to make the cached token not directly usable
  return token.accessToken
}

module.exports = {
  getEntraIdToken
}
