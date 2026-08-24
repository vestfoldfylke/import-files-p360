const { pdfTextExtract } = require("./pdf-text-extract")
const { writeFileSync } = require("node:fs")
const { jaroDistance } = require("./jaro-distance")

/**
 * @param {string[]} textElements Array of strings representing the input text (words, sentences, bag of words, whatever you like)
 * @param {string[]} matchElements Array of strings you are looking for in textElements
 * @param {Object} [options]
 * @param {number} [options.matchThreshold] Default=matchElements.length Minimum matching words to return match
 * @param {number} [options.jaroThreshold] Default=1 (no jaro) Minimum threshold for jaro-similarity (0-1) between words
 * @param {boolean} [options.jaroCaseSensitive] Default=true If you want jaro to be caseSensitive or not
 * @param {boolean} [options.verboseJaro] Default=false If you want to log jaro-results
 * @returns {boolean}
 */
const hasTextElements = (textElements, matchElements, options) => {
  const { matchThreshold = matchElements.length, jaroThreshold = 1, jaroCaseSensitive = true, verboseJaro = false } = options ?? {}

  let matches = 0
  for (const matchElement of matchElements) {
    if (textElements.includes(matchElement)) {
      matches++
      continue
    }
    if (jaroThreshold !== 1) {
      // One equals complete match (100% identical strings)
      const match = textElements.some((textElement) => {
        const jwScore = jaroDistance(matchElement, textElement, { caseSensitive: jaroCaseSensitive })
        if (verboseJaro) {
          console.log(`jaroDistance(${matchElement}, ${textElement}) = ${jwScore}`)
        }
        return jwScore > jaroThreshold
      })
      if (match) {
        matches++
      }
    }
  }
  return matches >= matchThreshold
}

/**
 * @typedef TextElements
 * @property {string[]} textLines
 * @property {string[]} textLinesNoWhiteSpace
 * @property {string[]} textWords
 * @property {string} text
 */

/**
 *
 * @param {string[]} textLines
 * @returns {TextElements}  textElements
 */
const getTextElements = (textLines) => {
  const filteredTextLines = textLines.filter((line) => line.length > 3 && /\S/.test(line)).map((line) => line.trim()) // Longer than 3 chars and not only whitespace, and remove trailing whitespace
  const textLinesNoWhiteSpace = filteredTextLines.map((line) => line.replace(/\s+/g, ""))
  const text = filteredTextLines.join(" ") // Text is all lines joined on whitespace
  const words = text
    .split(" ")
    .filter((word) => word.length > 3 && /\S/.test(word))
    .map((word) => word.trim()) // replaceAll(/\s/, '#'))
  return {
    textLines: filteredTextLines,
    textLinesNoWhiteSpace,
    textWords: words,
    text
  }
}

/**
 * @param {string} pdfPath
 */
const getAndSavePdfText = async (pdfPath) => {
  const pdfData = await pdfTextExtract({ url: pdfPath })
  const pages = pdfData.pages.map((page) => ({
    pageNumber: page.pageNumber,
    textElements: getTextElements(page.textLines)
  }))
  const newPath = `${pdfPath.substring(0, pdfPath.lastIndexOf("."))}.json`
  writeFileSync(newPath, JSON.stringify({ pages }, null, 2))
}

module.exports = { getPdfText: getAndSavePdfText, hasTextElements, getTextElements }
