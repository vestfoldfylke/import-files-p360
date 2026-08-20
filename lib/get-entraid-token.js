const { APPREG } = require('../config')
const { FileCache } = require('./file-cache')
const { ConfidentialClientApplication } = require("@azure/msal-node")

const tokenCache = new FileCache('./.token-cache')

const getEntraIdToken = async (scope, forceNew = false) => {
  const cacheKey = `${scope}-token`

  const cachedToken = tokenCache.get(cacheKey)
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
