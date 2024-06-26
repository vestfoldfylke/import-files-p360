(async () => {
  const { getFilesInDirWithMetadata, moveToDir, deleteOldFiles } = require('../lib/file-tools')
  const { BARCODE } = require('../config')
  const { sendToUnreg, sendToDocument } = require('../lib/archive')
  const { logger, logConfig } = require('@vtfk/logger')
  const { createLocalLogger } = require('../lib/create-local-logger')
  const { createStat } = require('../lib/stats')

  // Set up logging
  logConfig({
    prefix: 'import-barcode-to-p360',
    teams: {
      onlyInProd: false
    },
    localLogger: createLocalLogger('import-barcode-to-p360')
  })

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

  logger('info', [`Checking for files in ${BARCODE.INPUT_DIR}`])
  const files = getFilesInDirWithMetadata(BARCODE.INPUT_DIR, 'pdf')
  logger('info', [`${files.length} files ready for handling in ${BARCODE.INPUT_DIR}`])

  for (const file of files) {
    let barcodeData = null
    try {
      logger('info', [`Getting barcodedata for file ${file.filePath}`])
      barcodeData = getBarcodeData(file.fileNameWithoutExt)
      logger('info', [`Got barcodedata for file ${file.filePath}, nice nice`])
    } catch (error) {
      // Det er noe galt med dette dok - sender det rett til uregistrerte i stedet bare
      logger('error', [`Oh no, something is wrong with barcode data - ${error.toString()}, sending to unregistered instead`])
      try {
        const result = await sendToUnreg({ filename: file.fileNameWithoutExt, note: 'Dokument feilet ved strekkode-lesing', ext: file.fileExt, origin: '2', filepath: file.filePath })
        logger('info', ['Failed barcode sent to unregistered', result])
        moveToDir(file.filePath, `${BARCODE.INPUT_DIR}/barcode-imported-to-unregistered`)
        continue // Skip to next file
      } catch (innerError) {
        logger('error', ['Aiuau, failed when sending failed barcode to unregistered, will try again next run', innerError.response?.data || innerError.stack || innerError.toString()])
        continue // Skip to next file
      }
    }
    try {
      logger('info', [`sending ${file.filePath} to document in P360 with recno: ${barcodeData.docRecno}`])
      await sendToDocument(barcodeData, file)
      moveToDir(file.filePath, `${BARCODE.INPUT_DIR}/barcode-imported`)
      logger('info', [`Succesfylly added ${file.filePath} to document in P360 with recno: ${barcodeData.docRecno}`])
      // Opprett statistikk-element i stats db
      try {
        logger('info', ['Creating statistics element'])
        const stat = {
          company: 'Ukjent',
          description: 'Et dokument scannet inn til P360 med strekkode',
          type: 'Barcode-ScanTo360',
          documentTitle: 'Strekkode-scanning'
        }
        const statRes = await createStat(stat)
        logger('info', ['Successfully made statistics element', 'Object id', statRes.insertedId])
      } catch (innerError) {
        logger('warn', ['Failed when creating stat element', innerError.response?.data || innerError.stack || innerError.toString()])
      }
    } catch (error) {
      if (error.toString().includes(' does not exist...') || (error.response?.data?.message && error.response?.data?.message.includes('does not exist in Document'))) {
        logger('error', [`Oh no, document with recno ${barcodeData.docRecno} does not exist... moving to failed`, error.response?.data || error.stack || error.toString()])
        moveToDir(file.filePath, `${BARCODE.INPUT_DIR}/barcode-failed`)
        continue
      }
      logger('error', [`Oh no, something went wrong when sending ${file.filePath} to P360 document with recno: ${barcodeData.docRecno}, will try again next run`, error.response?.data || error.stack || error.toString()])
    }
  }

  // Delete imported after days
  deleteOldFiles(`${BARCODE.INPUT_DIR}/barcode-imported`, 30, 'pdf')
})()
