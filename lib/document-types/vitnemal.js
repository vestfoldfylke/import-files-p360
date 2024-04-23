const { COUNTY_NUMBER } = require('../../config')
const { jaroDistance } = require('../jaro-distance')
const { getTextElements, hasTextElements } = require('../text-tools')
const { logger } = require('@vtfk/logger')
const getSchools = require('vtfk-schools-info')
const validator = require('@navikt/fnrvalidator')
const { callArchive } = require('../call-archive')

const searchSchools = getSchools().filter(school => school.countyNumber === COUNTY_NUMBER).map(school => { return { searchstring: school.fullName.replaceAll(' ', '').toLowerCase(), ...school } })

const autoCorrectSsn = (textLines) => {
  const autoCorrectedLines = textLines.map(line => {
    const lineWords = line.split(' ')
    const wordsToCorrect = []
    for (const word of lineWords) {
      if (jaroDistance(word, 'Fødselsnummer:') > 0.83 && !wordsToCorrect.includes(word.replace(':', ''))) wordsToCorrect.push(word.replace(':', '')) // Just make the script find similar words for us
    }
    for (const wordToCorrect of wordsToCorrect) {
      line = line.replaceAll(wordToCorrect, 'Fødselsnummer')
    }
    return line
  })
  return autoCorrectedLines
}

/**
 *
 * @param {import('@vestfoldfylke/pdf-text-extract').PdfContent} pdfData
 */
const getVitnemal = async (pdfData) => {
  // Sjekk etter gitte kriterier for at dette er et vitnemål - hent så ut dataen vi trenger, om vi ikke har all data, gjør et eller annet

  // Vi antar at et skannet vitnemål finnes på førstesiden - hvis ikke får den tas manuelt, autcorrecter Fødselsnummer for å finne alle matcher på det
  const textLinesOnFirstPage = autoCorrectSsn(pdfData.pages[0].textLines)

  const textElements = getTextElements(textLinesOnFirstPage)

  // Control object (data we need)
  const vitnemal = {
    foundType: false,
    waitForNextRun: false,
    message: null,
    title: null,
    vitnemalId: null,
    name: null,
    ssn: null,
    privatePerson: null,
    documentDate: null,
    year: null,
    school: null
  }

  // Vi sjekker først at vi har identifikator-strenger for et vitnemål på første side
  const matchWords = ['skole', 'Atferd:', 'Orden:', 'Fravær', 'dato:', 'Sted', 'Skole:', 'timer', 'dager', 'utdanningsprogram']
  const matchOnWords = hasTextElements(textElements.textWords, matchWords, { matchThreshold: matchWords.length - 2, jaroThreshold: 0.9 })
  const matchLines = ['i utdanningsprogram for', 'Ved kopiering må begge sidene tas med. Formularet er godkjent av Utdanningsdirektoratet.']
  const matchOnLines = hasTextElements(textElements.textLines, matchLines, { matchThreshold: matchLines.length, jaroThreshold: 0.9 })
  if (!matchOnWords && !matchOnLines) {
    logger('info', ['Get-vitnemal', 'Fant ikke match på minst 7 av 9 ord, eller på tekstlinjer', matchWords])
    return vitnemal
  }
  const vitnemalId = textElements.textLinesNoWhiteSpace.find(str => str.startsWith('V') && str.length >= 18 && str.length <= 20 && str.replace(/\D/g, '').length > 12) // Last one returns only numbers
  const vitnemalTitle = textElements.textLines.slice(0, 5).some(line => jaroDistance(line, 'VITNEMAL') > 0.9)
  if (!vitnemalId && !vitnemalTitle) {
    logger('info', ['Get-vitnemal', 'Fant ingen vitnemålsId eller tittelen VITNEMAL i de første linjene'])
    return vitnemal
  }
  // Så sjekker vi at vi har navn
  let nameString = textElements.textLinesNoWhiteSpace.find(str => str.includes('Navn:')) // Navn:GubbaNoaHansen eller f.eks Navn:GubbanoaHansenFødselsnummer:12345678910
  if (!nameString) {
    logger('info', ['Get-vitnemal', 'Fant ikke streng som inneholdt Navn:'])
    return vitnemal
  }
  if (nameString.includes('Fødselsnummer:')) nameString = nameString.substring(0, nameString.indexOf('Fødselsnummer:'))
  vitnemal.name = nameString.replace('Navn:', '')

  // Så sjekker vi at vi har fnr
  const ssnString = textElements.textLinesNoWhiteSpace.find(str => str.includes('Fødselsnummer:'))
  if (!ssnString) {
    logger('info', ['Get-vitnemal', 'Fant ikke streng som inneholdt Fødselsnummer:'])
    return vitnemal
  }
  const ssnStringList = ssnString.split('Fødselsnummer:')
  vitnemal.ssn = ssnStringList[ssnStringList.length - 1]

  // Her kan vi vel anta at vi har et vitnemål - så vi setter tittel i det minste
  vitnemal.title = 'Vitnemål'

  const fnrCheck = validator.fnr(vitnemal.ssn)
  if (fnrCheck.status === 'invalid') {
    logger('info', ['Get-vitnemal', `Fødselsnummeret som ble funnet er ikke gyldig, pga ${fnrCheck.reasons}, men vi har nok et vitnemål her`])
    vitnemal.message = 'Roboten fant ikke fødselsnummer'
    return vitnemal
  }

  // Sjekk alle sidene i pdf-en, sjekk om det er flere enn et fødselsnummer i hele dokumentet - kan i så fall ikke arkivere rett på person, må sende til uregistrerte
  let allTextLines = []
  for (const page of pdfData.pages) {
    const autoCorrectedLines = autoCorrectSsn(page.textLines)
    const textElements = getTextElements(autoCorrectedLines)
    allTextLines = [...allTextLines, ...textElements.textLinesNoWhiteSpace]
  }

  const ssnLines = allTextLines.filter(line => line.includes('Fødselsnummer:'))
  for (const ssnLine of ssnLines) {
    const ssnLineList = ssnLine.split('Fødselsnummer:')
    const ssn = ssnLineList[ssnLineList.length - 1]
    if (ssn !== vitnemal.ssn) {
      logger('info', ['Get-vitnemal', 'Fant flere enn ett fødselsnummer i pdf-en, vi har nok flere vitnemål her'])
      vitnemal.message = 'Roboten fant flere enn ett fødselsnummer i dokumentet, trolig flere vitnemål'
      return vitnemal
    }
  }

  // Kjører sjekk mot SyncPrivatePerson at navnet er tilnærmet det samme som i teksten - hvis ikke likt nok - send tilbake null
  let privatePerson
  try {
    const syncPrivatePersonRes = await callArchive('SyncPrivatePerson', { ssn: vitnemal.ssn })
    privatePerson = syncPrivatePersonRes.privatePerson
  } catch (error) {
    const responseError = error.response?.data?.message
    if (responseError && responseError.startsWith('Error: Could not find anyone with that ssn')) {
      logger('info', ['Get-vitnemal', 'Ssn was not found in freg'])
      vitnemal.message = 'Roboten fant ingen i folkeregisteret med fødelsnummeret'
      return vitnemal
    }
    // Hva hvis freg er nede - blir kødd om vi da sender alt til uregistrerte - vi lar den bare vente til neste runde
    vitnemal.waitForNextRun = true
    return vitnemal
  }
  // Her skal vi ha en privatperson
  if (!privatePerson) throw new Error('Her skulle vi hatt privatePerson, men vi harn ikke???? Se på koden, den er rævva')
  // Sammenligner navn fra PDF med navn fra SyncPrivatePerson (PerBansen similar to PerHansen)
  const privatePersonCompareName = privatePerson.name.replaceAll(' ', '')
  if (jaroDistance(privatePersonCompareName, vitnemal.name) < 0.9) {
    logger('info', ['Get-vitnemal', `Navn fra SyncPrivatePerson: "${privatePersonCompareName}" lignet ikke nok på navn i pdf: "${vitnemal.name}"`])
    vitnemal.message = 'Roboten fant ikke match mellom navnet i vitnemålet og navnet i folkeregisteret'
    return vitnemal
  }

  vitnemal.privatePerson = privatePerson

  // Så sjekker vi at vi har dato (men ikke et krav) - default til dagens dato om vi ikke harn kanskje?
  const dateString = textElements.textLinesNoWhiteSpace.find(str => str.includes('Stedogdato:'))
  if (!dateString) {
    logger('info', ['Get-vitnemal', 'Fant ikke streng som inneholdt Stedogdato:'])
  } else {
    let potentialDate = dateString.replace(/\D/g, '')
    potentialDate = potentialDate.length === 8 ? `${potentialDate.substring(4)}-${potentialDate.substring(2, 4)}-${potentialDate.substring(0, 2)}` : null // YYYY-MM-DD
    if (potentialDate && new Date(potentialDate).toString() !== 'Invalid Date') {
      vitnemal.documentDate = new Date(potentialDate).toISOString()
      vitnemal.year = potentialDate.substring(0,4)
    } else {
      logger('info', ['Get-vitnemal', 'Fant ikke gyldig dato i Stedogdato:-streng'])
    }
  }

  // Så sjekker vi at vi har skole (men ikke et krav) - default til fylkeskommunen om vi itj harn kanskje
  let schoolString = textElements.textLinesNoWhiteSpace.find(str => str.includes('Skole:'))
  if (!schoolString) {
    logger('info', ['Get-vitnemal', 'Fant ikke streng som inneholdt Skole:'])
  } else {
    schoolString = schoolString.replace('Skole:', '').toLowerCase()

    const schools = searchSchools.filter(school => school.searchstring === schoolString)
    if (schools.length === 1) vitnemal.school = schools[0]
    else {
      // map schools to those who have higher jaroDistance than 0.85 compared to the schoolString from the text - then sort on jaroScore descending
      const jaroSchools = searchSchools.map(s => { return { jaroScore: jaroDistance(schoolString, s.searchstring), ...s } }).filter(jaroSchool => jaroSchool.jaroScore > 0.81).sort((a, b) => b.jaroScore - a.jaroScore)
      // logger('info', ['Get-vitnemal', 'JaroSchools', schoolString, jaroSchools.map(s => { return { searchstring: s.searchstring, jaroScore: s.jaroScore }})])
      if (jaroSchools.length > 0) {
        vitnemal.school = jaroSchools[0]
      } else {
        logger('info', ['Get-vitnemal', `Fant ingen skole med strengen ${schoolString}`])
      }
    }
  }

  // Da vart vi good og kan returnere dataene sammen med foundType gitt :D
  vitnemal.foundType = true

  return vitnemal
}

module.exports = { getVitnemal }
