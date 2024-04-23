(async () => {
  const { getFilesInDirWithMetadata, moveToDir, deleteOldFiles } = require('../lib/file-tools')
  const { VITNEMAL } = require('../config')
  const { logger, logConfig } = require('@vtfk/logger')
  const { callArchive } = require('../lib/call-archive')
  const { createLocalLogger } = require('../lib/create-local-logger')
  const { pdfTextExtract } = require('@vestfoldfylke/pdf-text-extract')
  const { getVitnemal } = require('../lib/document-types/vitnemal')
  const { readFileSync } = require('fs')
  const { createStat } = require('../lib/stats')


  // Set up logging
  logConfig({
    prefix: 'archive-vitnemal',
    teams: {
      onlyInProd: false
    },
    localLogger: createLocalLogger('archive-vitnemal')
  })

  logger('info', [`Checking for files in ${VITNEMAL.INPUT_DIR}`])
  const files = getFilesInDirWithMetadata(VITNEMAL.INPUT_DIR)
  logger('info', [`${files.length} files ready for handling in ${VITNEMAL.INPUT_DIR}`])

  for (const file of files) {
    logConfig({
      prefix: `archive-vitnemal - ${file.fileName}`
    })

    let pdfData
    try {
      pdfData = await pdfTextExtract({ url: file.filePath, verbosity: 0 })
    } catch (error) {
      logger('warn', ['Failed when reading pdf-text, will wait until next run', error.stack || error.toString()])
      continue
    }

    // Get vitnemål-data
    let vitnemal
    try {
      vitnemal = await getVitnemal(pdfData)
      if (vitnemal.waitForNextRun) { // FREG failed with some internal error - let's try again next run instead
        continue // maybe log as well
      }
      if (!vitnemal.foundType) {
        logger('warn', ['Har et vitnemål, men har ikke nok data!! Her er det noget kluss....'])
        continue
      }
    } catch (error) {
      // fancy error handling
      logger('error', ['Failed when getting data for vitnemål, will try again next run', error.stack || error.toString()])
      continue
    }

    // If we do not have document-date, set todays date
    if (!vitnemal.documentDate) vitnemal.documentDate = new Date().toISOString()
    // If we do not have school, set fallback school
    if (!vitnemal.school) {
      vitnemal.school = {
        organizationNumber: VITNEMAL.FALLBACK_ORGANIZATION_NUMBER,
        accessGroup: VITNEMAL.FALLBACK_ACCESS_GROUP
      }
    }

    // Sync Elevmappe for student
    let elevmappe
    try {
      const syncElevmappeRes = await callArchive('SyncElevmappe', { ssn: vitnemal.privatePerson.ssn })
      elevmappe = syncElevmappeRes.elevmappe
      logger('info', ['Successfully synced elevmappe', syncElevmappeRes.elevmappe.CaseNumber])
    } catch (error) {
      logger('error', ['Failed when syncing elevmappe - will try again next run', error.response?.data || error.stack || error.toString()])
      continue
    }

    const vitnemalTitle = `Vitnemål${vitnemal.year ? ' - ' + vitnemal.year : ''}`

    const vitnemalPayload = {
      service: 'DocumentService',
      method: 'CreateDocument',
      parameter: {
        Archive: 'Elevdokument',
        CaseNumber: elevmappe.CaseNumber,
        Title: vitnemalTitle,
        UnofficialTitle: `${vitnemalTitle} - ${vitnemal.privatePerson.name}`,
        DocumentDate: vitnemal.documentDate,
        Category: 'Dokument ut',
        Status: 'J',
        AccessCode: '26',
        Paragraph: 'Offl. § 26 første ledd',
        AccessCodeDescription: 'Offl §26 eksamensbesvarelser, fødelsnummer, personbilder i personregister',
        AccessGroup: vitnemal.school.accessGroup,
        ResponsibleEnterpriseNumber: vitnemal.school.organizationNumber,
        Contacts: [
          {
            ReferenceNumber: vitnemal.privatePerson.ssn,
            Role: 'Mottaker',
            IsUnofficial: true
          },
          {
            ReferenceNumber: vitnemal.school.organizationNumber,
            Role: 'Avsender',
            IsUnofficial: false
          }
        ],
        Files: [
          {
            Title: vitnemalTitle,
            Format: 'pdf',
            Base64Data: Buffer.from(readFileSync(file.filePath)).toString('base64')
          }
        ]
      }
    }

    // Archive the vitnemål
    try {
      const result = await callArchive('Archive', vitnemalPayload)
      logger('info', ['Successfully archived vitnemal', result])
      moveToDir(file.filePath, `${VITNEMAL.INPUT_DIR}/imported`)
      // Opprett statistikk-element i stats db
      try {
        logger('info', ['Creating statistics element'])
        const stat = {
          company: vitnemal.school?.name || 'Ukjent',
          description: 'Automatisk arkivert vitnemål fra scanner',
          type: 'vitnemål',
          documentTitle: 'Vitnemål'
        }
        const statRes = await createStat(stat)
        logger('info', ['Successfully made statistics element', 'Object id', statRes.insertedId])
      } catch (innerError) {
        logger('warn', ['Failed when creating stat element', innerError.response?.data || innerError.stack || innerError.toString()])
      }
    } catch (error) {
      logger('error', ['Failed when archiving vitnemal (or when moving to imported - might archive twice) - will try again next run', error.response?.data || error.stack || error.toString()])
      continue
    }
  }
  // Delete documents that are old enough from imported
  deleteOldFiles(`${VITNEMAL.INPUT_DIR}/imported`, 30, 'pdf')
})()
