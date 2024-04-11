const { logger } = require('@vtfk/logger')
const { jaroDistance } = require('./jaro-distance')
const { getTextElements } = require('./text-tools')

const knownT = [
  {
    "matchTextLine": "Alternativ vg3 i skole - referat halvårssamtale",
    "title": "Alternativ vg3 i skole - referat halvårssamtale"
  },
  {
    "matchTextLine": "Anestesilege og behandlende tannleges vurdering og påtegning ved tannbehandling i narkose",
    "title": "Anestesilege og behandlende tannleges vurdering og påtegning ved tannbehandling i narkose"
  },
  {
    "matchTextLine": "Arbeidsavtale",
    "title": "Arbeidsavtale"
  },
  {
    "matchTextLine": "Arbeidsavtale - endring",
    "title": "Arbeidsavtale - endring"
  },
  {
    "matchTextLine": "Arbeidsavtale - Samferdsel",
    "title": "Arbeidsavtale - Samferdsel"
  }
]

//console.log(knownT.sort((a,b) => b.matchTextLine.length - a.matchTextLine.length)) // longest strings first (so we find matches on the most specific first)

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
  "printedby",
  "case"
]

const startsWithUppercaseAndRestIsLowercase = (word) => {
  if (word.charAt(0).toUpperCase() !== word.charAt(0)) return false
  for (let i = 1; i < word.length; i++) {
    if (word.charAt(i).toLowerCase() !== word.charAt(1)) return false
  }
  return true
}

/**
 * @typedef KnownTitle
 * @property {string} matchTextLine
 * @property {string} title
 */

/**
 * 
 * @param {string[]} textLines
 * @param {KnownTitle[]} knownTitles
 */
const getProbableTitle = (textLines, knownTitles) => {
  const textElements = getTextElements(textLines)
  const firstLines = textElements.textLines.slice(0, 20).map(line => line.replace(/[^a-zA-Z0-9æøåÆØÅ.,\- ]/gi, '').replace('  ', ' ')).filter(line => line.length > 3 && /\S/.test(line)).map(line => line.trim()).slice(0, 9) // Bumpa til 9 linjer, se hva som skjer...
  
  // Check for match on one of the first lines
  for (const line of firstLines) {
    let jaroScore = 0
    const titleMatch = knownTitles.find(title => {
      if (title.matchTextLine === line) return true
      jaroScore = jaroDistance(title.matchTextLine, line, { caseSensitive: false })
      if (jaroScore > 0.88) return true
      return false
    })
    if (titleMatch) {
      logger('info', ['Found title-match', line, titleMatch.matchTextLine, 'Jaro-distance', jaroScore])
      return {
        title: titleMatch.title,
        type: 'Known-title'
      }
    }
  }
  // Check for exact match on lines joined together - no whitespace, no special chars, at least 14? chars (e.g arbeidsavtale)
  // Just maybe do the above - will it actually give many matches? Probably not

  // Then just guess the title i guess?
  let probableTitle
  for (const line of firstLines) {
    const cleanedLine = line.replace(/[^a-zA-Z0-9æøåÆØÅ]/gi, '').toLowerCase() // to match removelines-array
    let jaroScore = 0
    const shouldSkip = skipLines.find(skipLine => {
      jaroScore = jaroDistance(skipLine, cleanedLine)
      if (jaroScore > 0.88) return true
      return false
    })
    if (shouldSkip) {
      logger('info', ['Should skip line', line, shouldSkip, 'Jaro-distance', jaroScore])
      continue
    }
    // Sjekk om det bare er tull
    const superCleanedLine = cleanedLine.replace(/[^a-zæøå]/gi, '')
    if (superCleanedLine.length < 6) {
      logger('info', ['Probs doesnt make sense... Should skip line', line, superCleanedLine])
      continue
    }
    /*
    // Sjekk om det er kanskje er en adresse (inneholder mer enn 3 tall som ikke er årstall, eller inneholder "gate" eller "vei" og slutter på et tall (eller nest siste er  et tall)
    const numerical = cleanedLine.replace(/[^0-9]/gi, '')
    // OIOI må sjekke etter punktum på dato også - ikke sikkert det er postnummer... Bedre sjekk av tall altså  OPpholdstillatelse 4564554
    if (numerical.length > 3 && (Number(numerical) < 2010 || Number(numerical) > 2030)) {
      logger('info', ['More than three numbers here and probably not year. Should skip line', line, numerical])
      continue
    }
    */
    const lastChars = cleanedLine.substring(cleanedLine.length - 2, cleanedLine.length)
    const lastCharsHaveNumber = lastChars.replace(/[^0-9]/gi, '').length > 0
    if (['vei', 'gate', 'veg', 'sving', 'krok'].some(substr => cleanedLine.includes(substr)) && lastCharsHaveNumber) {
      logger('info', ['Line has something that looks like address, and ends with number, probably address', line, cleanedLine])
      continue
    }
    // Sjekk om det er paragraf greier
    if (cleanedLine.includes("unntattoffentlighet") || line.includes('offl.') || superCleanedLine.includes('unntattoff') || cleanedLine.includes("unntoffentlighet")) {
      logger('info', ['Line has "unntatt offentlighet" probably laws and stuff', line, superCleanedLine])
      continue
    }

    // Sjekk om det kan være et navn bare - hva om vi fjerner kjente ord - sjekk om vi bare står igjen med navn, i så fall, skip
    // Sjekk om flere enn ett ord - sjekk om alle ordene starter med uppercase og deretter har lowercase
    const lineWords = line.split(' ')
    if (lineWords.every(word => startsWithUppercaseAndRestIsLowercase(word))) {
      logger('info', ['Every word in the line starts with uppercase and rest is lowercase, probably a name', line])
      continue
    }

    // Fjern dato - se om det er nok tekst igjen til å gi mening (hva mener du her Jørgen?)

    // Noe fusker - ikke alltid den returnerer probable title hvis den fant en - se gjennom loopen

    // Kan teste å replace vekk alle ord som er i skipLines, og se om resultatet er langt nok som tittel? EKS Horten VGS. Vsesfltold fylkeskomm. Sentralt fakturamottak.

    // Om ikke funnet noe - sjekk om line inklduderer "barnevern" eller "barneverntjeneste" - sett på barnevernsdokument

    probableTitle = line
    if (line.charAt(0).toUpperCase() === line.charAt(0) || true) {
      return {
        title: probableTitle,
        type: 'Probable-title'
      }
    }
  }
  // Lage en filter funksjon som bare fjerner linjer som ikke er sannsynlige titler, slå sammen de resterende til tittel??
}

/*
let testLines = ["HJFUD", " X i / hfu", "Arbidsavtale", "$&/$/()"]
let test2 = ["HUHOO", " X i / hfu dhu jif 77fd jhife", "Legeerkløing om noe stuff", "$&/$/()"]
console.log(getProbableTitle(testLines, knownT))
console.log(getProbableTitle(test2, knownT))


console.log(jaroDistance("V I T N E M A L", "Vitnemål"))
*/

module.exports = { getProbableTitle }