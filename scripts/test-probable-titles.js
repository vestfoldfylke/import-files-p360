
(async () => {
  const { getFilesInDirWithMetadata, moveToDir } = require("../lib/file-tools")
  const { TEST_TITLES_INPUT_DIR, TEST_TITLES_OUTPUT_DIR, UNREGISTERED } = require("../config")
  const { sendToUnreg } = require("../lib/archive")
  const { logger, logConfig } = require('@vtfk/logger')
  const { createLocalLogger } = require("../lib/create-local-logger")
  const { getUnregAdUser } = require("../lib/get-ad-user")
  const { pdfTextExtract } = require("@vestfoldfylke/pdf-text-extract")
  const { getVitnemal } = require("../lib/document-types/vitnemal")
  const { getProbableTitle } = require("../lib/title-check")
  const knownTitles = require('../data/known-titles.json')
  const { getTextElements } = require("../lib/text-tools")
  const { writeFileSync } = require('fs')

  /**
   * 
   * @param {import('../lib/file-tools').FileMetadata} file 
   * @param {*} error
   * @param {string} msg 
   */
  const handleFileError = (file, error, msg='Aiaiai, failed') => {
    logger('error', `${msg} - ${error.response?.data || error.stack || error.toString()}`)
    moveToDir(file.filePath, UNREGISTERED.FAILED_DIR)
  }

  /**
   * 
   * @param {string} scannedBy
   * @param {import('../lib/file-tools').FileMetadata} file 
   * @returns {string} note
   */
  const createDocumentNote = (scannedBy, file) => {
    const timestamp = `${file.createdTimestamp.toDateString()} ${file.createdTimestamp.toTimeString().substring(0,8)}` // GJØR OM TIMESTAMP TIL 07.03.2024 (7 mars)
    return `Scannet av: ${scannedBy} - ${timestamp}`
  }

  // Set up logging
  logConfig({
    prefix: 'test-probable-titles',
    teams: {
      onlyInProd: false
    },
    localLogger: createLocalLogger('test-probable-titles')
  })

  logger('info', [`Checking for files in ${TEST_TITLES_INPUT_DIR}`])
  const files = getFilesInDirWithMetadata(TEST_TITLES_INPUT_DIR)
  logger('info', [`${files.length} files ready for handling in ${TEST_TITLES_INPUT_DIR}`])
  
  knownTitles.sort((a,b) => b.matchTextLine.length - a.matchTextLine.length)
  logger('info', [`Sorted knownTitles by length, longest first`])

  let probableTitles = []

  for (const file of files) {
    logConfig({
      prefix: `test-probable-titles - ${file.fileName}`,
    })
    // Get user that scanned file - files from autostore on the format "_{UserDisplayName}_ _{UserEmail}___{FileID}.pdf"
    const filenameParts = file.fileName.split('__')
    const userPart = filenameParts[0]
    const scannedByEmail = userPart.substring(userPart.lastIndexOf('_')+1) // Skriv om til å hente e-post ut av filnavnet, samma hvordan det ser ut

    // Get AD-user if enabled in config (disable in local env when no access to get-aduser)
    let documentNote
    /*
    if (UNREGISTERED.GET_AD_USER) {
      try {
        const adUser = await getUnregAdUser(scannedByEmail)
        if (adUser) documentNote = createDocumentNote(`${adUser.Company} - ${adUser.DisplayName}`, file)
      } catch (error) {
        logger('warn', [`Feilet ved henting av ${scannedByEmail} i AD, setter bare scannedByEmail som note`, error.stack || error.toString()])
      }
    }
    */
    // If no adUser or not enabled, set simple note with scannedByEmail
    if (!documentNote) documentNote = createDocumentNote(`Ukjent virksomhet - ${scannedByEmail}`, file)

    let pdfData
    try {
      pdfData = await pdfTextExtract({ url: file.filePath, verbosity: 0 })
    } catch (error) {
      logger('warn', ['Failed when reading pdf-text, will send to unreg without any further data'])
      pdfData = null
    }
    if (!pdfData) continue

    const probableTitle = getProbableTitle(pdfData.pages[0].textLines, knownTitles)
    const textElements = getTextElements(pdfData.pages[0].textLines)
    const firstLines = textElements.textLines.slice(0, 20).map(line => line.replace(/[^a-zA-Z0-9æøåÆØÅ.\- ]/gi, '').replace('  ', ' ')).filter(line => line.length > 3 && /\S/.test(line)).map(line => line.trim()).slice(0, 7)
    
    writeFileSync(`${TEST_TITLES_OUTPUT_DIR}/${file.fileNameWithoutExt}.json`, JSON.stringify({ firstLines, probableTitle }, null, 2))

    probableTitles.push(probableTitle)

    const documentData = { // Hva om vi gjør dette - så kan vi sette litt underveis (f. eks hvis vi "nesten" kunne arkivere automatisk men navn ikke matchet f.eks)
      title: null,
      note: null
    }
  }
  console.log(probableTitles)

})()