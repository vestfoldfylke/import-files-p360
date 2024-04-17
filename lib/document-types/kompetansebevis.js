const { COUNTY_NUMBER } = require('../../config')
const { jaroDistance } = require('../jaro-distance')
const { getTextElements, hasTextElements } = require('../text-tools')
const { logger } = require('@vtfk/logger')
const getSchools = require('vtfk-schools-info')
const validator = require('@navikt/fnrvalidator')
const { callArchive } = require('../call-archive')

const searchSchools = getSchools().filter(school => school.countyNumber === COUNTY_NUMBER).map(school => { return {  searchstring: school.fullName.replaceAll(' ', '').toLowerCase(), ...school } })

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
const getKompetansebevis = async (pdfData) => {
  // Sjekk etter gitte kriterier for at dette er et kompetansebevis - hent så ut dataen vi trenger, om vi ikke har all data, gjør et eller annet
  
  // Vi antar at et skannet kompetansebevis finnes på førstesiden - hvis ikke får den tas manuelt, autcorrecter Fødselsnummer for å finne alle matcher på det
  const textLinesOnFirstPage = autoCorrectSsn(pdfData.pages[0].textLines)

  const textElements = getTextElements(textLinesOnFirstPage)

  // Control object (data we need)
  const kompetansebevis = {
    foundType: false,
    waitForNextRun: false,
    message: null,
    title: null,
    kompetansebevisId: null,
    name: null,
    ssn: null,
    privatePerson: null,
    documentDate: null,
    school: null
  }

  // Vi sjekker først at vi har identifikator-strenger for et kompetansebevis på første side
  const matchWords = ["skole", "Atferd:", "Orden:", "omfang:", "dato:", "Sted", "Skole:", "gjennomført", "opplæring", "utdanningsprogram"]
  const matchOnWords = hasTextElements(textElements.textWords, matchWords, { matchThreshold: matchWords.length - 2, jaroThreshold: 0.9 })
  const matchLines = ['har gjennomført opplæring som omfatter', 'Ved kopiering må begge sidene tas med. Formularet er godkjent av Utdanningsdirektoratet.']
  const matchOnLines = hasTextElements(textElements.textLines, matchLines, { matchThreshold: matchLines.length, jaroThreshold: 0.9 })
  if (!matchOnWords && !matchOnLines) {
    logger('info', ["Fant ikke match på minst 7 av 9 ord, eller på tekstlinjer", matchWords, matchLines])
    return kompetansebevis
  }
  // Enten kompetansebevisId eller tittelen KOMPETANSEBEVIS
  const kompetansebevisId = textElements.textLinesNoWhiteSpace.find(str => str.startsWith('K') && str.length >= 18 && str.length <= 20 && str.replace(/\D/g, "").length > 12) // Last one returns only numbers
  const kompetanseTitle = textElements.textLines.slice(0,5).some(line => jaroDistance(line, 'KOMPETANSEBEVIS') > 0.9)
  if (!kompetansebevisId && !kompetanseTitle) {
    logger('info', ["Fant ingen kompetansebevissId eller tittelen KOMPETANSEBEVIS i de første linjene"])
    return kompetansebevis
  }
  // Så sjekker vi at vi har navn
  let nameString = textElements.textLinesNoWhiteSpace.find(str => str.includes('Navn:')) // Navn:GubbaNoaHansen eller f.eks Navn:GubbanoaHansenFødselsnummer:12345678910
  if (!nameString) {
    logger('info', ["Fant ikke streng som inneholdt Navn:"])
    return kompetansebevis
  }
  if (nameString.includes("Fødselsnummer:")) nameString = nameString.substring(0, nameString.indexOf("Fødselsnummer:"))
  kompetansebevis.name = nameString.replace("Navn:", '')
  
  // Så sjekker vi at vi har fnr
  let ssnString = textElements.textLinesNoWhiteSpace.find(str => str.includes('Fødselsnummer:'))
  if (!ssnString) {
    logger('info', ["Fant ikke streng som inneholdt Fødselsnummer:"])
    return kompetansebevis
  }
  const ssnStringList = ssnString.split("Fødselsnummer:")
  kompetansebevis.ssn = ssnStringList[ssnStringList.length-1]

  // Her kan vi vel anta at vi har et kompetansebevis - så vi setter tittel i det minste
  kompetansebevis.title = 'Kompetansebevis'

  const fnrCheck = validator.fnr(kompetansebevis.ssn)
  if (fnrCheck.status === 'invalid') {
    logger('warn', [`Fødselsnummeret som ble funnet er ikke gyldig, pga ${fnrCheck.reasons}, men vi har nok et kompetansebevis her`])
    kompetansebevis.message = 'Roboten fant ikke fødselsnummer'
    return kompetansebevis
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
    const ssnLineList = ssnLine.split("Fødselsnummer:")
    const ssn = ssnLineList[ssnLineList.length-1]
    if (ssn !== kompetansebevis.ssn) {
      logger('warn', [`Fant flere enn ett fødselsnummer i pdf-en, vi har nok flere kompetansebevis her`])
      kompetansebevis.message = 'Roboten fant flere enn ett fødselsnummer i dokumentet, trolig flere kompetansebevis'
      return kompetansebevis
    }
  }

  // Kjører sjekk mot SyncPrivatePerson at navnet er tilnærmet det samme som i teksten - hvis ikke likt nok - send tilbake null
  let privatePerson
  try {
    const syncPrivatePersonRes = await callArchive('SyncPrivatePerson', { ssn: kompetansebevis.ssn })
    privatePerson = syncPrivatePersonRes.privatePerson
  } catch (error) {
    const responseError = error.response?.data?.message
    if (responseError && responseError.startsWith('Error: Could not find anyone with that ssn')) {
      logger('warn', ['Ssn was not found in freg'])
      kompetansebevis.message = 'Roboten fant ingen i folkeregisteret med fødelsnummeret'
      return kompetansebevis
    }
    // Hva hvis freg er nede - blir kødd om vi da sender alt til uregistrerte - vi lar den bare vente til neste runde
    kompetansebevis.waitForNextRun = true
    return kompetansebevis
  }
  // Her skal vi ha en privatperson
  if (!privatePerson) throw new Error('Her skulle vi hatt privatePerson, men vi harn ikke???? Se på koden, den er rævva')
  // Sammenligner navn fra PDF med navn fra SyncPrivatePerson (PerBansen similar to PerHansen)
  const privatePersonCompareName = privatePerson.name.replaceAll(' ', '')
  if (jaroDistance(privatePersonCompareName, kompetansebevis.name) < 0.9) {
    logger('warn', [`Navn fra SyncPrivatePerson: "${privatePersonCompareName}" lignet ikke nok på navn i pdf: "${kompetansebevis.name}"`])
    kompetansebevis.message = 'Roboten synes ikke navnet i kompetansebeviset og navnet i folkeregisteret stemte overens...'
    return kompetansebevis
  }

  kompetansebevis.privatePerson = privatePerson
  
  // Så sjekker vi at vi har dato (men ikke et krav) - default til dagens dato om vi ikke harn kanskje?
  let dateString = textElements.textLinesNoWhiteSpace.find(str => str.includes("Stedogdato:"))
  if (!dateString) {
    logger('info', ["Fant ikke streng som inneholdt Stedogdato:"])
  } else {
    let potentialDate = dateString.replace(/\D/g, "")
    potentialDate = potentialDate.length === 8 ? `${potentialDate.substring(4)}-${potentialDate.substring(2, 4)}-${potentialDate.substring(0, 2)}` : null
    if (potentialDate && new Date(potentialDate).toString() !== 'Invalid Date') {
      kompetansebevis.documentDate = new Date(potentialDate).toISOString()
    } else {
      logger('info', ["Fant ikke gyldig dato i Stedogdato:-streng"])
    }
  }

  // Så sjekker vi at vi har skole (men ikke et krav) - default til fylkeskommunen om vi itj harn kanskje
  let schoolString = textElements.textLinesNoWhiteSpace.find(str => str.includes("Skole:"))
  if (!schoolString) {
    logger('info', ["Fant ikke streng som inneholdt Skole:"])
  } else {
    schoolString = schoolString.replace('Skole:', '').toLowerCase()
    
    let schools = searchSchools.filter(school => school.searchstring === schoolString)
    if (schools.length === 1) kompetansebevis.school = schools[0]
    else {
      // map schools to those who have higher jaroDistance than 0.85 compared to the schoolString from the text - then sort on jaroScore descending
      const jaroSchools = searchSchools.map(s => { return { jaroScore: jaroDistance(schoolString, s.searchstring), ...s } }).filter(jaroSchool => jaroSchool.jaroScore > 0.81).sort((a,b) => b.jaroScore - a.jaroScore)
      // logger('info', ['JaroSchools', schoolString, jaroSchools.map(s => { return { searchstring: s.searchstring, jaroScore: s.jaroScore }})])
      if (jaroSchools.length > 0) {
        kompetansebevis.school = jaroSchools[0]
      } else {
        logger('info', [`Fant ingen skole med strengen ${schoolString}`])
      }
    }
  }

  // Da vart vi good og kan returnere dataene sammen med foundType gitt :D
  kompetansebevis.foundType = true

  return kompetansebevis
}

module.exports = { getKompetansebevis }