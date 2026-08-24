const { logger } = require("@vestfoldfylke/loglady")
const { jaroDistance } = require("./jaro-distance")
const { getTextElements } = require("./text-tools")
const validator = require("@navikt/fnrvalidator")

const skipLines = [
  "vestfold",
  "telemark",
  "vestfoldogtelemark",
  "fylkeskommune",
  "fylkeskomm.",
  "kommune",
  "vestfoldogtelemarkfylkeskommune",
  "vestfoldfylkeskommune",
  "telemarkfylkeskommune",
  "videregåendeskole",
  "videregåandeskule",
  "bamblevideregåendeskole",
  "bamble",
  "bøvideregåandeskule",
  "bø",
  "rjukanvideregåendeskole",
  "rjukan",
  "kragerøvideregåendeskole",
  "kragerø",
  "notoddenvideregåendeskole",
  "notodden",
  "porsgrunnvideregåendeskole",
  "porsgrunn",
  "skienvideregåendeskole",
  "skien",
  "hjalmarjohansenvideregåendeskole",
  "hjalmarjohansen",
  "skogmovideregåendeskole",
  "skogmo",
  "nomevideregåendeskole",
  "nome",
  "færdervideregåendeskole",
  "færder",
  "sandevideregåendeskole",
  "sande",
  "kompetansebyggeren",
  "greveskogenvideregåendeskole",
  "greveskogen",
  "melsomvideregåendeskole",
  "melsom",
  "skolenforsosialeogmedisinskeinstitusjoner",
  "smiskolen",
  "revideregåendeskole",
  "re",
  "hortenvideregåendeskole",
  "horten",
  "sandefjordvideregåendeskole",
  "sandefjord",
  "thorheyerdahlvideregåendeskole",
  "thorheyerdahl",
  "holmestrandvideregåendeskole",
  "holmestrand",
  "nøtterøyvideregåendeskole",
  "nøtterøy",
  "fagskolenvestfoldogtelemark",
  "fagskolenvestfold",
  "fagskolentelemark",
  "fagskolen",
  "telemarkfylkeskommuneprivatisteksamen",
  "vestfoldfylkeskommuneprivatisteksamen",
  "saksbehandler",
  "adresse",
  "returadresse",
  "sentraltfakturamottak",
  "postboks",
  "trudvang",
  "tønsberg",
  "færder",
  "skien",
  "vestfoldfogtelemarkdokumentsenteret",
  "dokumentsenteret",
  "dokumentasjonssenteret",
  "epost",
  "tlf",
  "navn",
  "kontaktperson",
  "avsender",
  "bufetat",
  "vårdato",
  "deresdato",
  "dato",
  "documentid",
  "versionid",
  "documentno",
  "title",
  "type",
  "møte",
  "tilstede",
  "printedby",
  "case",
  "versjon",
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
  "postnr",
  "larvik",
  "saksansv",
  "arkiv",
  "saksnr",
  "enterprisehrm",
  "møtedeltaker",
  "videregåendeopplæring",
  "vestreviken",
  "sykehusetivestfold"
]

const skipLinesSortedByLength = [...skipLines].sort((a, b) => b.length - a.length)

/**
 * @param {string} word
 * @returns {boolean}
 */
const startsWithUppercaseAndRestIsLowercase = (word) => {
  if (word.length === 1) {
    return false
  }
  if (/^\d/.test(word)) {
    return false
  }
  if (word.charAt(0).toUpperCase() !== word.charAt(0)) {
    return false
  }

  for (let i = 1; i < word.length; i++) {
    if (word.charAt(i).toLowerCase() !== word.charAt(i)) {
      return false
    }
  }
  return true
}

/**
 * @typedef KnownTitle
 * @property {string} matchTextLine
 * @property {string} title
 */

/**
 * @typedef Zipcode
 * @property {string} Postnummer
 * @property {string} Poststed
 */

/**
 * @param {string[]} textLines
 * @param {KnownTitle[]} knownTitles
 * @param {Zipcode[]} zipcodes
 * @returns {{ title: string, type: 'Known-title' | 'Barnevern-sjekk' | 'Probable-title' } | null}
 */
const getProbableTitle = (textLines, knownTitles, zipcodes) => {
  const textElements = getTextElements(textLines)
  const firstLines = textElements.textLines
    .map((line) => line.replace(/[^a-zA-Z0-9æøåÆØÅ.,\- ]/gi, "").replace("  ", " "))
    .filter((line) => line.length > 3 && /\S/.test(line))
    .map((line) => line.trim())
    .slice(0, 9) // Bumpa til 9 linjer, se hva som skjer...

  if (firstLines.length === 0) {
    return null
  }

  // Check for match on one of the first lines
  for (const line of firstLines) {
    /** @type {(KnownTitle & { jaroScore: number }) | null} */
    let titleMatch = null
    for (const knownTitle of knownTitles) {
      const jaroThreshold = line.length > 10 ? 0.88 : 0.9
      const jaroScore = jaroDistance(knownTitle.matchTextLine, line, { caseSensitive: false, factorLengthDifference: true })
      if (jaroScore > jaroThreshold && jaroScore > (titleMatch?.jaroScore ?? 0)) {
        titleMatch = { ...knownTitle, jaroScore }
      }
    }

    if (titleMatch !== null) {
      logger.info("Found title-match - Line: {Line} - Matched: {Matched} - Jaro-distance: {JaroScore}", line, titleMatch.matchTextLine, titleMatch.jaroScore)
      return {
        title: titleMatch.title,
        type: "Known-title"
      }
    }
  }
  // Check for exact match on lines joined together - no whitespace, no special chars, at least 14? chars (e.g arbeidsavtale)
  // Just maybe do the above - will it actually give many matches? Probably not

  // Then just guess the title i guess?
  for (const line of firstLines) {
    if (line.length > 100) {
      logger.info("Line is toooooo long... Should skip line: {Line}", line)
      continue
    }
    const cleanedLine = line.replace(/[^a-zA-Z0-9æøåÆØÅ]/gi, "").toLowerCase() // to match removelines-array
    let jaroScore = 0
    const shouldSkip = skipLines.find((skipLine) => {
      jaroScore = jaroDistance(skipLine, cleanedLine)
      if (jaroScore > 0.88) {
        return true
      }

      return false
    })

    if (shouldSkip) {
      logger.info("Should skip line: {Line} - Matched skip: {ShouldSkip} - Jaro-distance: {JaroScore}", line, shouldSkip, jaroScore)
      continue
    }

    // Sjekk om det bare er tull
    const superCleanedLine = cleanedLine.replace(/[^a-zæøå]/gi, "")
    if (superCleanedLine.length < 6) {
      logger.info("Probs doesnt make sense... Should skip line: {Line} - Cleaned: {SuperCleanedLine}", line, superCleanedLine)
      continue
    }

    // Fjern ord på to bokstaver eller mindre - sjekk om det resterende bare er tull
    const lineWords = line.split(" ")
    const stringsWithSomeLength = lineWords.filter((word) => word.length > 2)
    const lineWithRemovedShortWords = stringsWithSomeLength.join("").replace(/[^a-zæøå]/gi, "")

    if (lineWithRemovedShortWords.length < 6) {
      logger.info("Have removed short words, and the rest probs doesnt make sense... Should skip line: {Line} - Remaining: {LineWithRemovedShortWords}", line, lineWithRemovedShortWords)
      continue
    }

    // Sjekk om det er kanskje er en adresse (inneholder mer enn 3 tall som ikke er årstall, eller inneholder "gate" eller "vei" og slutter på et tall (eller nest siste er  et tall)
    const lastChars = cleanedLine.substring(cleanedLine.length - 2, cleanedLine.length)
    const lastCharsHaveNumber = lastChars.replace(/[^0-9]/gi, "").length > 0

    if (cleanedLine.length < 50 && ["vei", "gate", "gata", "veg", "sving", "krok", "skog", "byen", "holmen"].some((substr) => cleanedLine.includes(substr)) && lastCharsHaveNumber) {
      // Adresser burde være mindre enn 50 tegn, inneholde et eller annet vei-ord, og ha et tall i en av de to siste tegnene
      logger.info("Line has something that looks like address, and ends with number, probably address: {Line} - Cleaned: {CleanedLine}", line, cleanedLine)
      continue
    }
    // Sjekk om det er paragraf greier
    if (
      cleanedLine.includes("unntattoffentlighet") ||
      line.includes("offl.") ||
      superCleanedLine.includes("unntattoff") ||
      cleanedLine.includes("unntoffentlighet") ||
      cleanedLine.includes("offentleglova") ||
      cleanedLine.includes("lovomoffentlighet")
    ) {
      logger.info('Line has "unntatt offentlighet" probably laws and stuff: {Line} - Cleaned: {SuperCleanedLine}', line, superCleanedLine)
      continue
    }

    // Sjekk om det kan være et navn bare - hva om vi fjerner kjente ord - sjekk om vi bare står igjen med navn, i så fall, skip
    // Sjekk om flere enn ett ord - sjekk om alle ordene starter med uppercase og deretter har lowercase
    const nameWords = line.replace("-", " ").split(" ")
    if (nameWords.length > 1 && nameWords.every((word) => startsWithUppercaseAndRestIsLowercase(word))) {
      logger.info("At least two words, and every word in the line starts with uppercase and rest is lowercase, probably a name: {Line} - Words: {@NameWords}", line, nameWords)
      continue
    }

    // Sjekk om det finnes et gyldig postnummer i lineWords - legg zipCode objektet i så fall inn i potentialZipcode
    const potentialZipcode = zipcodes.find((zipcode) => lineWords.some((word) => word === zipcode.Postnummer)) // Finn en zipcode i zipcodes, der zipcode sitt Postnummer finnes i lineWords
    if (potentialZipcode && lineWords.some((word) => word.toLowerCase().trim() === potentialZipcode.Poststed.toLowerCase())) {
      // Hvis vi fant et postnummer i lineWords, sjekk om lineWords også inneholder poststedet som tilhører potentialZipcode
      logger.info("Both postnummer and poststed present - skipping line: {Line} - Words: {@LineWords}", line, lineWords)
      continue
    }

    // Kan teste å replace vekk alle ord som er i skipLines, og se om resultatet er langt nok som tittel? EKS Horten VGS. Vsesfltold fylkeskomm. Sentralt fakturamottak.
    let strippedLine = cleanedLine.replace(/[^a-zA-ZæøåÆØÅ]/gi, "")
    for (const skipLine of skipLinesSortedByLength) {
      if (skipLine.length < 3) {
        continue
      }
      strippedLine = strippedLine.replace(skipLine, "")
    }

    if (strippedLine.length < 6) {
      logger.info("Not much left after removing skiplines... probably nothing useful here: {Line} - Cleaned: {CleanedLine} - Stripped: {StrippedLine}", line, cleanedLine, strippedLine)
      continue
    }

    // Sjekk om linja inneholder fnr - i så fall - skip
    const probableSsn = cleanedLine.replace(/[^0-9]/gi, "")

    const fnrCheck = validator.fnr(probableSsn)
    if (fnrCheck.status === "valid") {
      logger.info("This is a valid fnr - skipping line - Ssn: {ProbableSsn} - Line: {Line}", `${probableSsn.substring(0, 6)}******`, line)
      continue
    }

    // Om ikke funnet noe - sjekk om line inklduderer "barnevern" eller "barneverntjeneste" - sett på barnevernsdokument
    if (["barnevern", "barneverntjeneste"].some((substr) => cleanedLine.includes(substr))) {
      logger.info("Probably barnevernsdokument: {CleanedLine}", cleanedLine)
      return {
        title: "Trolig barnevernsdokument",
        type: "Barnevern-sjekk"
      }
    }

    return {
      title: line,
      type: "Probable-title"
    }
  }
  // Om ingen tittel, gjør det samme, men start litt lenger ned i dokumentet og sjekk videre
  return getProbableTitle(textLines.slice(9, textLines.length), knownTitles, zipcodes)
}

module.exports = { getProbableTitle }
