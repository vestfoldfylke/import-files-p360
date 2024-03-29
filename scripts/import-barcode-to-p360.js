(async () => {
  const { getFilesInDirWithMetadata, moveToDir } = require("../lib/file-tools")
  const { BARCODE } = require("../config")
  const { sendToUnreg, sendToDocument,  } = require("../lib/archive")
  const { logger, logConfig } = require('@vtfk/logger')
  const { createLocalLogger } = require("../lib/create-local-logger")

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
    if (!isNumber(versionId)) throw new Error('Ohoh, secobd element is not a number / recno')
    if (!['HOVED', 'VEDLEGG'].includes(docType)) throw new Error('Ohoh, docType is not VEDLEGG or HOVED')

    return {
      docRecno,
      versionId,
      docType
    }
  }

  logger('info', [`Checking for files in ${BARCODE.BARCODE_INPUT_DIR}`])
  const files = getFilesInDirWithMetadata(BARCODE.BARCODE_INPUT_DIR)
  logger('info', [`${files.length} files ready for handling in ${BARCODE.BARCODE_INPUT_DIR}`])
  

  for (const file of files) {
    let barcodeData = null
    try {
      logger('info', [`Getting barcodedata for file ${file.filePath}`])
      barcodeData = getBarcodeData(file.fileNameWithoutExt)
      logger('info', [`Got barcodedata for file ${file.filePath}, nice nice`])
    } catch (error) {
      // Det er noe galt med dette dok - sender det rett til uregistrerte i stedet bare
      logger('error', [`Oh no, something is wrong with barcode data - ${error.toString()}`])
      const result = await sendToUnreg({ filename: file.fileNameWithoutExt, msg: 'Dokument feilet ved strekkode-lesing', ext: file.fileExt, origin: '2', filepath: file.filePath })
      logger('info', result)
      moveToDir(file.filePath, BARCODE.BARCODE_IMPORTED_TO_UNREG_DIR)
    }
    try {
      logger('info', [`sending ${file.filePath} to document in P360 with recno: ${barcodeData.docRecno}`])
      await sendToDocument(barcodeData, file)
      moveToDir(file.filePath, BARCODE.BARCODE_IMPORTED_DIR)
      logger('info', [`Succesfylly added ${file.filePath} to document in P360 with recno: ${barcodeData.docRecno}`])
    } catch (error) {
      logger('error', [`Oh no, something went wrong when sending ${file.filePath} to P360 document with recno: ${barcodeData.docRecno} - ${error.toString()}`])
    }
  }

})()