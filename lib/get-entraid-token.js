const { APPREG } = require('../config')
const Cache = require('file-system-cache').default
const { getAccessToken } = require('@vestfoldfylke/msal-token')

const tokenCache = Cache({
  basePath: './.token-cache'
})

const getEntraIdToken = async (scope, forceNew = false) => {
  const cacheKey = `${scope}-token`

  const cachedToken = tokenCache.getSync(cacheKey)
  if (!forceNew && cachedToken) {
    return cachedToken.substring(0, cachedToken.length - 2)
  }

  const clientConfig = {
    clientId: APPREG.CLIENT_ID,
    clientSecret: APPREG.CLIENT_SECRET,
    tenantId: APPREG.TENANT_ID,
    scopes: [scope]
  }
  const token = await getAccessToken(clientConfig)
  const expires = Math.floor((token.expiresOn.getTime() - new Date()) / 1000)
  tokenCache.setSync(cacheKey, `${token.accessToken}==`, expires) // Haha, just to make the cached token not directly usable
  return token.accessToken
}

module.exports = {
  getEntraIdToken
}
