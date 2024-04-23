(async () => {
  const { getFilesInDirWithMetadata } = require('../lib/file-tools')
  const { TEST_TITLES_INPUT_DIR, TEST_TITLES_OUTPUT_DIR } = require('../config')
  const { logger, logConfig } = require('@vtfk/logger')
  const { createLocalLogger } = require('../lib/create-local-logger')
  const { pdfTextExtract } = require('@vestfoldfylke/pdf-text-extract')
  const { getProbableTitle } = require('../lib/title-check')
  const knownTitles = require('../data/known-titles.json')
  const { getTextElements } = require('../lib/text-tools')
  const { writeFileSync } = require('fs')
  const csv = require('csvtojson')

  // Set up logging
  logConfig({
    prefix: 'test-probable-titles',
    teams: {
      onlyInProd: false
    },
    localLogger: createLocalLogger('test-probable-titles')
  })

  knownTitles.sort((a, b) => b.matchTextLine.length - a.matchTextLine.length)
  logger('info', ['Sorted knownTitles by length, longest first - for use in titleCheck'])

  logger('info', [`Checking for files in ${TEST_TITLES_INPUT_DIR}`])
  const files = getFilesInDirWithMetadata(TEST_TITLES_INPUT_DIR)
  logger('info', [`${files.length} files ready for handling in ${TEST_TITLES_INPUT_DIR}`])

  // Get zipcodes
  const zipcodes = await csv({ delimiter: '\t' }).fromFile('./data/postnummer.txt')

  const probableTitles = []
  const allFoundTitles = []

  for (const file of files) {
    logConfig({
      prefix: `test-probable-titles - ${file.fileName}`
    })

    let pdfData
    try {
      pdfData = await pdfTextExtract({ url: file.filePath, verbosity: 0 })
    } catch (error) {
      logger('warn', ['Failed when reading pdf-text, will send to unreg without any further data'])
      pdfData = null
    }
    if (!pdfData) continue

    const probableTitle = getProbableTitle(pdfData.pages[0].textLines, knownTitles, zipcodes)
    const textElements = getTextElements(pdfData.pages[0].textLines)
    const firstLines = textElements.textLines.map(line => line.replace(/[^a-zA-Z0-9æøåÆØÅ.,\- ]/gi, '').replace('  ', ' ')).filter(line => line.length > 3 && /\S/.test(line)).map(line => line.trim()).slice(0, 50)

    writeFileSync(`${TEST_TITLES_OUTPUT_DIR}/${file.fileNameWithoutExt}.json`, JSON.stringify({ probableTitle, firstLines }, null, 2))

    probableTitles.push(probableTitle)
    if (probableTitle) {
      const existingTitle = allFoundTitles.find(title => title.title === probableTitle.title)
      if (existingTitle) {
        existingTitle.number++
      } else {
        allFoundTitles.push({ title: probableTitle.title, number: 1 })
      }
    }
  }
  allFoundTitles.sort((a, b) => b.number - a.number)

  writeFileSync(`${TEST_TITLES_OUTPUT_DIR}/_0all-titles.json`, JSON.stringify(allFoundTitles, null, 2))
})()
