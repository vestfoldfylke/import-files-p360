const { jaroDistance } = require("../jaro-distance")

/**
 * @param {string[]} textLines
 * @returns {string[]}
 */
const autoCorrectSsn = (textLines) => {
  const autoCorrectedLines = textLines.map((line) => {
    const lineWords = line.split(" ")
    /** @type {string[]} */
    const wordsToCorrect = []

    for (const word of lineWords) {
      if (jaroDistance(word, "Fødselsnummer:") > 0.83 && !wordsToCorrect.includes(word.replace(":", ""))) {
        wordsToCorrect.push(word.replace(":", "")) // Just make the script find similar words for us
      }
    }

    for (const wordToCorrect of wordsToCorrect) {
      line = line.replaceAll(wordToCorrect, "Fødselsnummer")
    }

    return line
  })

  return autoCorrectedLines
}

module.exports = {
  autoCorrectSsn
}
