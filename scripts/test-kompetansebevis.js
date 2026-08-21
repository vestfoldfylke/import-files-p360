;(async () => {
  const { getFilesInDirWithMetadata, moveToDir } = require("../lib/file-tools")
  const { logger } = require("@vestfoldfylke/loglady")
  const { pdfTextExtract } = require("../lib/pdf-text-extract")
  const { getKompetansebevis } = require("../lib/document-types/kompetansebevis")
  const { formatError } = require("../lib/error-tools")
  const { writeFileSync } = require("node:fs")

  logger.logConfig({ prefix: "test-kompetansebevis" })

  const kompetansebevisDir = "./tests/local-data/kompetansebevis"

  logger.info("Checking for files in {Dir}", kompetansebevisDir)
  const files = getFilesInDirWithMetadata(kompetansebevisDir, "pdf")
  logger.info("{FileCount} files ready for handling in {Dir}", files.length, kompetansebevisDir)

  for (const file of files) {
    logger.logConfig({ prefix: `test-kompetansebevis - ${file.fileName}` })

    let pdfData
    try {
      pdfData = await pdfTextExtract({ url: file.filePath, verbosity: 0 })
    } catch (error) {
      logger.warn("Failed when reading pdf-text: {ErrorMessage}", formatError(error))
      pdfData = null // Why just not continue here - am i idiot? yes
    }

    if (!pdfData) {
      continue
    }

    if (pdfData) {
      // No use if we do not have pdfdata
      try {
        const kompetansebevis = await getKompetansebevis(pdfData)
        if (kompetansebevis.waitForNextRun) {
          // FREG failed with some internal error - let's try again next run instead
          continue // maybe log as well
        }
        if (kompetansebevis.foundType) {
          // We have what we need - move file along with data to job that handles vitnemål
          // move files and stuff and continue to next doc
          logger.info("Fant kompetansebevis, og kan arkivere automatisk 😄 Flytter filen til kompetansebevis-input-mappe")
          try {
            moveToDir(file.filePath, `${kompetansebevisDir}/success`)
            const p2 = `${kompetansebevisDir}/success/${file.fileNameWithoutExt}-result.json`
            writeFileSync(p2, JSON.stringify({ kompetansebevis, pdfData }, null, 2))
          } catch (error) {
            logger.warn("Offh, feila ved flytting av kompetansebevis... prøver igjen ved neste kjøring: {ErrorMessage}", formatError(error))
          }
          continue
        }

        logger.info("Fant itj kompetansebevis her altså... lagrer text for å se pån")
        const p1 = `${file.filePath.substring(0, file.filePath.lastIndexOf("."))}-text.json`

        writeFileSync(p1, JSON.stringify({ pdfData, kompetansebevis }, null, 2))
      } catch (error) {
        // fancy error handling
        logger.errorException(error, "Failed when checking for kompetansebevis, will try again next run")
      }
    }
  }
})()
