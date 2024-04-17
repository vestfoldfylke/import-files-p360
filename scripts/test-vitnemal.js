(async () => {
  const { getFilesInDirWithMetadata, moveToDir } = require("../lib/file-tools")
  const { logger, logConfig } = require('@vtfk/logger')
  const { createLocalLogger } = require("../lib/create-local-logger")
  const { pdfTextExtract } = require("@vestfoldfylke/pdf-text-extract")
  const { getVitnemal } = require("../lib/document-types/vitnemal")
  const { writeFileSync } = require('fs')

  // Set up logging
  logConfig({
    prefix: 'test-vitnemal',
    teams: {
      onlyInProd: false
    },
    localLogger: createLocalLogger('test-vitnemal')
  })

  const vitnemalDir = './tests/local-data/vitnemal'

  logger('info', [`Checking for files in ${vitnemalDir}`])
  const files = getFilesInDirWithMetadata(vitnemalDir, 'pdf')
  logger('info', [`${files.length} files ready for handling in ${vitnemalDir}`])
  
  for (const file of files) {
    logConfig({
      prefix: `test-vitnemal - ${file.fileName}`,
    })

    let pdfData
    try {
      pdfData = await pdfTextExtract({ url: file.filePath, verbosity: 0 })
    } catch (error) {
      logger('warn', ['Failed when reading pdf-text', error.stack || error.toString()])
      pdfData = null // Why just not continue here - am i idiot? yes
    }
    if (!pdfData) continue

    if (pdfData) { // No use if we do not have pdfdata
      try {
        const vitnemal = await getVitnemal(pdfData)
        if (vitnemal.waitForNextRun) { // FREG failed with some internal error - let's try again next run instead
          continue // maybe log as well
        }
        if (vitnemal.foundType) { // We have what we need - move file along with data to job that handles vitnemål
          // move files and stuff and continue to next doc
          logger('info', ['Fant vitnemål, og kan arkivere automatisk 😄 Flytter filen til vitnemål-input-mappe'])
          try {
            moveToDir(file.filePath, `${vitnemalDir}/success`)
            const p2 = `${vitnemalDir}/success/${file.fileNameWithoutExt}-result.json`
            writeFileSync(p2, JSON.stringify({ vitnemal, pdfData }, null, 2))
          } catch (error) {
            logger('warn', ['Offh, feila ved flytting av vitnemål... prøver igjen ved neste kjøring', error.stack || error.toString()])
          }
          continue
        }
        logger('info', ['Fant itj vitnemål her altså... lagrer text for å se pån'])
        const p1 = file.filePath.substring(0, file.filePath.lastIndexOf('.')) + "-text.json"
        writeFileSync(p1, JSON.stringify({pdfData, vitnemal}, null, 2))
      } catch (error) {
        // fancy error handling
        logger('error', ['Failed when checking for vitnemål, will try again next run', error.stack || error.toString()])
        continue
      }
    }
  }
})()