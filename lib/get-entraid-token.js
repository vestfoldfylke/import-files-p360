const { APPREG } = require('../config')
// const { logger } = require('@vtfk/logger')
const Cache = require('file-system-cache').default
const { getAccessToken } = require('@vestfoldfylke/msal-token')

const tokenCache = Cache({
  basePath: './.token-cache'
})

const getEntraIdToken = async (scope, forceNew = false) => {
  const cacheKey = `${scope}-token`

  const cachedToken = tokenCache.getSync(cacheKey)
  if (!forceNew && cachedToken) {
    // logger('info', ['getGraphToken', 'found valid token in cache, will use that instead of fetching new'])
    return cachedToken.substring(0, cachedToken.length - 2)
  }

  // logger('info', ['getEntraIDToken', 'no token in cache, fetching new from entra'])

  const clientConfig = {
    clientId: APPREG.CLIENT_ID,
    clientSecret: APPREG.CLIENT_SECRET,
    tenantId: APPREG.TENANT_ID,
    scopes: [scope]
  }
  const token = await getAccessToken(clientConfig)
  const expires = Math.floor((token.expiresOn.getTime() - new Date()) / 1000)
  // logger('info', ['getEntraIDToken', `Got token from Microsoft, expires in ${expires} seconds.`])
  tokenCache.setSync(cacheKey, `${token.accessToken}==`, expires) // Haha, just to make the cached token not directly usable
  // logger('info', ['getEntraIDToken', 'Token stored in cache'])
  return token.accessToken
}

module.exports = {
  getEntraIdToken
}