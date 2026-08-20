(async () => {
  const { getFilesInDirWithMetadata, moveToDir, deleteOldFiles } = require('../lib/file-tools')
  const { BARCODE } = require('../config')
  const { sendToUnreg, sendToDocument } = require('../lib/archive')
  const { logger } = require('@vestfoldfylke/loglady')
  const { createStat } = require('../lib/stats')

  logger.logConfig({ prefix: 'import-barcode-to-p360' })

  const isNumber = num => { return !isNaN(num) }

  const getBarcodeData = (fileName) => {
    const fileNameList = fileName.split('_')

    if (fileNameList.length < 3) throw new Error('Oh oh, not 3 BARCODEr here')

    const docRecno = fileNameList[0]
    const versionId = fileNameList[1]
    const docType = fileNameList[2]

    if (!isNumber(docRecno)) throw new Error('Ohoh, first element is not a number / recno')
    if (!isNumber(versionId)) throw new Error('Ohoh, second element is not a number / recno')
    if (!['HOVED', 'VEDLEGG'].includes(docType)) throw new Error('Ohoh, docType is not VEDLEGG or HOVED')

    // Sjekk om docRecno er 0 - da er det no kluss
    if (Number(docRecno) === 0) throw new Error('Ohoh, recno is 0 - that will not work...')

    return {
      docRecno,
      versionId,
      docType
    }
  }

  logger.info('Checking for files in {InputDir}', BARCODE.INPUT_DIR)
  const files = getFilesInDirWithMetadata(BARCODE.INPUT_DIR, 'pdf')
  logger.info('{FileCount} files ready for handling in {InputDir}', files.length, BARCODE.INPUT_DIR)

  for (const file of files) {
    let barcodeData = null
    try {
      logger.info('Getting barcodedata for file {FilePath}', file.filePath)
      barcodeData = getBarcodeData(file.fileNameWithoutExt)
      logger.info('Got barcodedata for file {FilePath}, nice nice', file.filePath)
    } catch (error) {
      // Det er noe galt med dette dok - sender det rett til uregistrerte i stedet bare
      logger.errorException(error, 'Oh no, something is wrong with barcode data, sending to unregistered instead')
      try {
        const result = await sendToUnreg({ filename: file.fileNameWithoutExt, note: 'Dokument feilet ved strekkode-lesing', ext: file.fileExt, origin: '2', filepath: file.filePath })
        logger.info('Failed barcode sent to unregistered - Result: {@Result}', result)
        moveToDir(file.filePath, `${BARCODE.INPUT_DIR}/barcode-imported-to-unregistered`)
        continue // Skip to next file
      } catch (innerError) {
        logger.errorException(innerError, 'Aiuau, failed when sending failed barcode to unregistered, will try again next run')
        continue // Skip to next file
      }
    }
    try {
      logger.info('Sending {FilePath} to document in P360 with recno: {DocRecno}', file.filePath, barcodeData.docRecno)
      await sendToDocument(barcodeData, file)
      moveToDir(file.filePath, `${BARCODE.INPUT_DIR}/barcode-imported`)
      logger.info('Succesfylly added {FilePath} to document in P360 with recno: {DocRecno}', file.filePath, barcodeData.docRecno)
      // Opprett statistikk-element i stats db
      try {
        logger.info('Creating statistics element')
        const stat = {
          company: 'Ukjent',
          description: 'Et dokument scannet inn til P360 med strekkode',
          type: 'Barcode-ScanTo360',
          documentTitle: 'Strekkode-scanning'
        }
        const statRes = await createStat(stat)
        logger.info('Successfully made statistics element - Object id: {InsertedId}', statRes.insertedId)
      } catch (innerError) {
        logger.warn('Failed when creating stat element: {ErrorMessage}', innerError.response?.data || innerError.stack || innerError.toString())
      }
    } catch (error) {
      if (error.toString().includes(' does not exist...') || (error.response?.data?.message && error.response?.data?.message.includes('does not exist in Document'))) {
        logger.errorException(error, 'Oh no, document with recno {DocRecno} does not exist... moving to failed', barcodeData.docRecno)
        moveToDir(file.filePath, `${BARCODE.INPUT_DIR}/barcode-failed`)
        continue
      }
      logger.errorException(error, 'Oh no, something went wrong when sending {FilePath} to P360 document with recno: {DocRecno}, will try again next run', file.filePath, barcodeData.docRecno)
    }
  }

  // Delete imported after days
  deleteOldFiles(`${BARCODE.INPUT_DIR}/barcode-imported`, 30, 'pdf')
})()
