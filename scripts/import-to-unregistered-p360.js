// biome-ignore format: preserve leading semicolon
(async () => {
  const { getFilesInDirWithMetadata, moveToDir, deleteOldFiles } = require("../lib/file-tools")
  const { UNREGISTERED, VITNEMAL, KOMPETANSEBEVIS } = require("../config")
  const { sendToUnreg } = require("../lib/archive")
  const { logger } = require("@vestfoldfylke/loglady")
  const { getUnregAdUser } = require("../lib/get-ad-user")
  const { pdfTextExtract } = require("../lib/pdf-text-extract")
  const knownTitles = require("../data/known-titles.json")
  const zipCodes = require("../data/postnummer.json")
  const { getVitnemal } = require("../lib/document-types/vitnemal")
  const { getKompetansebevis } = require("../lib/document-types/kompetansebevis")
  const { getProbableTitle } = require("../lib/title-check")
  const { createStat } = require("../lib/stats")
  const { formatError } = require("../lib/error-tools")

  /**
   *
   * @param {string} scannedBy
   * @param {import('../lib/file-tools').FileMetadata} file
   * @returns {string} note
   */
  const createDocumentNote = (scannedBy, file) => {
    const fileDate = file.createdTimestamp.getDate()
    const fileMonth = file.createdTimestamp.getMonth() + 1
    const fileYear = file.createdTimestamp.getFullYear()
    const timestamp = `${fileDate}.${fileMonth}.${fileYear} ${file.createdTimestamp.toTimeString().substring(0, 5)}`
    // const timestamp = `${file.createdTimestamp.toDateString()} ${file.createdTimestamp.toTimeString().substring(0,8)}` // Wed Mar 13 2024 13:36:31
    return `Scannet av: ${scannedBy} - ${timestamp}`
  }

  logger.logConfig({ prefix: "import-to-unregistered-p360" })

  if (!UNREGISTERED.INPUT_DIR) {
    throw new Error("UNREGISTERED_INPUT_DIR must be set")
  }
  if (!UNREGISTERED.UNNECESSARY_XML_DIR) {
    throw new Error("UNREGISTERED_UNNECESSARY_XML_DIR must be set")
  }
  if (!VITNEMAL.INPUT_DIR) {
    throw new Error("VITNEMAL_INPUT_DIR must be set")
  }
  if (!KOMPETANSEBEVIS.INPUT_DIR) {
    throw new Error("KOMPETANSEBEVIS_INPUT_DIR must be set")
  }

  // Get required data for finding probable title
  knownTitles.sort((a, b) => b.matchTextLine.length - a.matchTextLine.length)
  logger.info("Sorted knownTitles by length, longest first - for use in titleCheck")

  logger.info("Checking for files in {InputDir}", UNREGISTERED.INPUT_DIR)
  const files = getFilesInDirWithMetadata(UNREGISTERED.INPUT_DIR, "pdf")
  logger.info("{FileCount} files ready for handling in {InputDir}", files.length, UNREGISTERED.INPUT_DIR)

  for (const file of files) {
    logger.logConfig({ prefix: `import-to-unregistered-p360 - ${file.fileName}` })
    // Get user that scanned file - files from autostore on the format "_{UserDisplayName}_ _{UserEmail}___{FileID}.pdf"
    const filenameParts = file.fileName.split("__")
    const userPart = filenameParts[0]
    const scannedByEmail = userPart.substring(userPart.lastIndexOf("_") + 1) // Skriv om til å hente e-post ut av filnavnet, samma hvordan det ser ut

    /** @type {{ title: string | null, note: string }} */
    const documentData = {
      // Hva om vi gjør dette - så kan vi sette litt underveis (f. eks hvis vi "nesten" kunne arkivere automatisk men navn ikke matchet f.eks)
      title: null,
      note: ""
    }

    // Get AD-user if enabled in config (disable in local env when no access to get-aduser)
    let adUser
    if (UNREGISTERED.GET_AD_USER) {
      try {
        adUser = await getUnregAdUser(scannedByEmail)
        if (adUser) {
          documentData.note = createDocumentNote(`${adUser.Company} - ${adUser.DisplayName}`, file)
        }
      } catch (error) {
        logger.warn("Feilet ved henting av {ScannedByEmail} i AD, setter bare scannedByEmail som note: {ErrorMessage}", scannedByEmail, formatError(error))
      }
    }

    // If no adUser or not enabled, set simple note with scannedByEmail
    if (!documentData.note) {
      documentData.note = createDocumentNote(`Ukjent virksomhet - ${scannedByEmail}`, file)
    }

    let pdfData
    try {
      pdfData = await pdfTextExtract({ url: file.filePath, verbosity: 0 })
    } catch (error) {
      logger.warn("Failed when reading pdf-text, will send to unreg without any further data: {ErrorMessage}", formatError(error))
      pdfData = null
    }

    // AUTOMATIC ARCHIVING CHECK
    // Check if known document for automatic archiving (add types here as they are needed) - (vitnemal / kompetansebevis)

    // VITNEMÅL
    if (pdfData) {
      // No use if we do not have pdfdata
      try {
        const vitnemal = await getVitnemal(pdfData) // Hva om vi returnerer tittel og litt notes om vi kommer et stykke på vei
        if (vitnemal.waitForNextRun) {
          // FREG failed with some internal error - let's try again next run instead
          continue // maybe log as well
        }

        if (vitnemal.foundType) {
          // We have what we need - move file along with data to job that handles vitnemål
          // move files and stuff and continue to next doc
          logger.info("Fant vitnemål, og kan arkivere automatisk 😄 Flytter filen til vitnemål-input-mappe")
          try {
            moveToDir(file.filePath, VITNEMAL.INPUT_DIR)
          } catch (error) {
            logger.warn("Offh, feila ved flytting av vitnemål... prøver igjen ved neste kjøring: {ErrorMessage}", formatError(error))
          }
          continue
        }

        // We did not get the data we need, check for message and title and add to doc
        if (vitnemal.message) {
          documentData.note += `\n${vitnemal.message}`
        }
        if (vitnemal.title && !documentData.title) {
          documentData.title = vitnemal.title
        }
      } catch (error) {
        // fancy error handling
        logger.errorException(error, "Failed when checking for vitnemål, will try again next run")
        continue
      }

      // KOMPETANSEBEVIS (endre her etterpå)
      try {
        const kompetansebevis = await getKompetansebevis(pdfData) // Hva om vi returnerer tittel og litt notes om vi kommer et stykke på vei
        if (kompetansebevis.waitForNextRun) {
          // FREG failed with some internal error - let's try again next run instead
          continue // maybe log as well
        }

        if (kompetansebevis.foundType) {
          // We have what we need - move file along with data to job that handles kompetansebevis
          // move files and stuff and continue to next doc
          logger.info("Fant kompetansebevis, og kan arkivere automatisk 😄 Flytter filen til kompetansebevis-input-mappe")
          try {
            moveToDir(file.filePath, KOMPETANSEBEVIS.INPUT_DIR)
          } catch (error) {
            logger.warn("Offh, feila ved flytting av kompetansebevis... prøver igjen ved neste kjøring: {ErrorMessage}", formatError(error))
          }
          continue
        }

        // We did not get the data we need, check for message and title and add to doc
        if (kompetansebevis.message) {
          documentData.note += `\n${kompetansebevis.message}`
        }
        if (kompetansebevis.title && !documentData.title) {
          documentData.title = kompetansebevis.title
        }
      } catch (error) {
        // fancy error handling
        logger.errorException(error, "Failed when checking for kompetansebevis, will try again next run")
        continue
      }

      // END AUTOMATIC ARCHIVING CHECK //

      // If no title yet - check for a known title - use fancy stuff we made
      if (!documentData.title) {
        const probableTitle = getProbableTitle(pdfData.pages[0].textLines, knownTitles, zipCodes)
        if (probableTitle) {
          logger.info("Found probable document title {Title} - type {Type}", probableTitle.title, probableTitle.type)
          documentData.title = probableTitle.title
        } else {
          logger.info("Could not find probable document title - setting default title")
          documentData.title = "Ukjent dokumentttype"
        }
      }
    }

    const title = documentData.title ?? "Ukjent dokumentttype"
    try {
      const result = await sendToUnreg({ filename: title, note: documentData.note, ext: file.fileExt, origin: "2", filepath: file.filePath })
      logger.info("Successfully imported to unregistered - Result: {@Result}", result)
      moveToDir(file.filePath, `${UNREGISTERED.INPUT_DIR}/imported`, `${title}_${file.fileName}`)
      // Opprett statistikk-element i stats db
      try {
        logger.info("Creating statistics element")
        const stat = {
          company: adUser?.Company || "Ukjent",
          description: "Et dokument scannet inn til P360",
          type: "ScanTo360",
          documentTitle: title
        }
        const statRes = await createStat(stat)
        logger.info("Successfully made statistics element - Object id: {InsertedId}", statRes.insertedId)
      } catch (innerError) {
        logger.warn("Failed when creating stat element: {ErrorMessage}", formatError(innerError))
      }
    } catch (error) {
      logger.errorException(error, "Failed when uploading to unregistered (or when moving to imported) - moving to failed folder")
      moveToDir(file.filePath, `${UNREGISTERED.INPUT_DIR}/failed`, `${title}_${file.fileName}`)
    }
  }

  logger.logConfig({ prefix: "import-to-unregistered-p360" })
  // Delete documents that are old enough - both from imported - and delete the xml-log-files from pixedit in the input-folder
  deleteOldFiles(`${UNREGISTERED.INPUT_DIR}/imported`, 30, "pdf")
  deleteOldFiles(UNREGISTERED.UNNECESSARY_XML_DIR, 30, "xml")
})()
