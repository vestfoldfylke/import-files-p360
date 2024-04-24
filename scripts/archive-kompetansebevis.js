(async () => {
  const { getFilesInDirWithMetadata, moveToDir, deleteOldFiles } = require('../lib/file-tools')
  const { KOMPETANSEBEVIS } = require('../config')
  const { logger, logConfig } = require('@vtfk/logger')
  const { callArchive } = require('../lib/call-archive')
  const { createLocalLogger } = require('../lib/create-local-logger')
  const { pdfTextExtract } = require('@vestfoldfylke/pdf-text-extract')
  const { getKompetansebevis } = require('../lib/document-types/kompetansebevis')
  const { readFileSync } = require('fs')
  const { createStat } = require('../lib/stats')

  // Set up logging
  logConfig({
    prefix: 'archive-kompetansebevis',
    teams: {
      onlyInProd: false
    },
    localLogger: createLocalLogger('archive-kompetansebevis')
  })

  logger('info', [`Checking for files in ${KOMPETANSEBEVIS.INPUT_DIR}`])
  const files = getFilesInDirWithMetadata(KOMPETANSEBEVIS.INPUT_DIR, 'pdf')
  logger('info', [`${files.length} files ready for handling in ${KOMPETANSEBEVIS.INPUT_DIR}`])

  for (const file of files) {
    logConfig({
      prefix: `archive-kompetansebevis - ${file.fileName}`
    })

    let pdfData
    try {
      pdfData = await pdfTextExtract({ url: file.filePath, verbosity: 0 })
    } catch (error) {
      logger('warn', ['Failed when reading pdf-text, will wait until next run', error.stack || error.toString()])
      continue
    }

    // Get Kompetansebevis-data
    let kompetansebevis
    try {
      kompetansebevis = await getKompetansebevis(pdfData)
      if (kompetansebevis.waitForNextRun) { // FREG failed with some internal error - let's try again next run instead
        continue // maybe log as well
      }
      if (!kompetansebevis.foundType) {
        logger('warn', ['Har et Kompetansebevis, men har ikke nok data!! Her er det noget kluss....'])
        continue
      }
    } catch (error) {
      // fancy error handling
      logger('error', ['Failed when getting data for Kompetansebevis, will try again next run', error.stack || error.toString()])
      continue
    }

    // If we do not have document-date, set todays date
    if (!kompetansebevis.documentDate) kompetansebevis.documentDate = new Date().toISOString()
    // If we do not have school, set fallback school
    if (!kompetansebevis.school) {
      kompetansebevis.school = {
        organizationNumber: KOMPETANSEBEVIS.FALLBACK_ORGANIZATION_NUMBER,
        accessGroup: KOMPETANSEBEVIS.FALLBACK_ACCESS_GROUP
      }
    }

    // Sync Elevmappe for student
    let elevmappe
    try {
      const syncElevmappeRes = await callArchive('SyncElevmappe', { ssn: kompetansebevis.privatePerson.ssn })
      elevmappe = syncElevmappeRes.elevmappe
      logger('info', ['Successfully synced elevmappe', syncElevmappeRes.elevmappe.CaseNumber])
    } catch (error) {
      logger('error', ['Failed when syncing elevmappe - will try again next run', error.response?.data || error.stack || error.toString()])
      continue
    }

    const kompetansebevisTitle = `Kompetansebevis${kompetansebevis.year ? ' - ' + kompetansebevis.year : ''}`

    const kompetansebevisPayload = {
      service: 'DocumentService',
      method: 'CreateDocument',
      parameter: {
        Archive: 'Elevdokument',
        CaseNumber: elevmappe.CaseNumber,
        Title: kompetansebevisTitle,
        UnofficialTitle: `${kompetansebevisTitle} - ${kompetansebevis.privatePerson.name}`,
        DocumentDate: kompetansebevis.documentDate,
        Category: 'Dokument ut',
        Status: 'J',
        AccessCode: '26',
        Paragraph: 'Offl. § 26 første ledd',
        AccessCodeDescription: 'Offl §26 eksamensbesvarelser, fødelsnummer, personbilder i personregister',
        AccessGroup: kompetansebevis.school.accessGroup,
        ResponsibleEnterpriseNumber: kompetansebevis.school.organizationNumber,
        Contacts: [
          {
            ReferenceNumber: kompetansebevis.privatePerson.ssn,
            Role: 'Mottaker',
            IsUnofficial: true
          },
          {
            ReferenceNumber: kompetansebevis.school.organizationNumber,
            Role: 'Avsender',
            IsUnofficial: false
          }
        ],
        Files: [
          {
            Title: kompetansebevisTitle,
            Format: 'pdf',
            Base64Data: Buffer.from(readFileSync(file.filePath)).toString('base64')
          }
        ]
      }
    }

    // Archive the Kompetansebevis
    try {
      const result = await callArchive('Archive', kompetansebevisPayload)
      logger('info', ['Successfully archived kompetansebevis', result])
      moveToDir(file.filePath, `${KOMPETANSEBEVIS.INPUT_DIR}/imported`)
      // Opprett statistikk-element i stats db
      try {
        logger('info', ['Creating statistics element'])
        const stat = {
          company: kompetansebevis.school?.name || 'Ukjent',
          description: 'Automatisk arkivert kompetansebevis fra scanner',
          type: 'kompetansebevis',
          documentTitle: 'Kompetansebevis'
        }
        const statRes = await createStat(stat)
        logger('info', ['Successfully made statistics element', 'Object id', statRes.insertedId])
      } catch (innerError) {
        logger('warn', ['Failed when creating stat element', innerError.response?.data || innerError.stack || innerError.toString()])
      }
    } catch (error) {
      logger('error', ['Failed when archiving kompetansebevis (or when moving to imported - might archive twice) - will try again next run', error.response?.data || error.stack || error.toString()])
      continue
    }
  }
  // Delete documents that are old enough from imported
  deleteOldFiles(`${KOMPETANSEBEVIS.INPUT_DIR}/imported`, 30, 'pdf')
})()
