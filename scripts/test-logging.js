(async () => {
  const { logger } = require('@vestfoldfylke/loglady')

  logger.logConfig({ prefix: 'test-logging' })

  logger.info('Info-melding med parameter: {Name}', 'Knut')

  const sampleObject = {
    saba: 'hei',
    boba: 'halla',
    caba: 'hallo'
  }

  logger.debug('Debug-melding med objekt: {@Sample}', sampleObject)
  logger.warn('Warn-melding med objekt: {@Sample}', sampleObject)
  logger.error('Error-melding med objekt: {@Sample}', sampleObject)

  try {
    throw new Error('Dette er en testfeil')
  } catch (error) {
    logger.errorException(error, 'Fanget forventet exception under test-logging')
  }
})()
