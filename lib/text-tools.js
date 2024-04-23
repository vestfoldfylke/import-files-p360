const { pdfTextExtract } = require('@vestfoldfylke/pdf-text-extract')
const { writeFileSync } = require('fs')
const { jaroDistance } = require('./jaro-distance')

/**
 *
 * @param {string[]} textElements Array of strings representing the input text (words, sentences, bag of words, whatever you like)
 * @param {string[]} matchElements Array of strings you are looking for in textElements
 * @param {Object} options
 * @param {number} [options.matchThreshold] Default=matchElements.length Minimum matching words to return match
 * @param {number} [options.jaroThreshold] Default=1 (no jaro) Minimum threshold for jaro-similarity (0-1) between words
 * @param {boolean} [options.jaroCaseSensitive] Default=true If you want jaro to be caseSensitive or not
 * @param {boolean} [options.verboseJaro] Default=false If you want to log jaro-results
 */
const hasTextElements = (textElements, matchElements, options) => {
  // set default values
  if (!options) options = {}
  if (!options.matchThreshold) options.matchThreshold = matchElements.length
  if (!options.jaroThreshold) options.jaroThreshold = 1
  if (typeof options.jaroCaseSensitive !== 'boolean') options.jaroCaseSensitive = true

  let matches = 0
  for (const matchElement of matchElements) {
    if (textElements.includes(matchElement)) {
      matches++
      continue
    }
    if (options.jaroThreshold !== 1) { // One equals complete match (100% identical strings)
      const match = textElements.some(textElement => {
        const jwScore = jaroDistance(matchElement, textElement, { caseSensitive: options.jaroCaseSensitive })
        if (options.verboseJaro) console.log(`jaroDistance(${matchElement}, ${textElement}) = ${jwScore}`)
        if (jwScore > options.jaroThreshold) return true
        return false
      })
      if (match) {
        matches++
        continue
      }
    }
  }
  if (matches >= options.matchThreshold) return true
  return false
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
  const filteredTextLines = textLines.filter(line => line.length > 3 && /\S/.test(line)).map(line => line.trim()) // Longer than 3 chars and not only whitespace, and remove trailing whitespace
  const textLinesNoWhiteSpace = filteredTextLines.map(line => line.replace(/\s+/g, ''))
  const text = filteredTextLines.join(' ') // Text is all lines joined on whitespace
  const words = text.split(' ').filter(word => word.length > 3 && /\S/.test(word)).map(word => word.trim()) // replaceAll(/\s/, '#'))
  return {
    textLines: filteredTextLines,
    textLinesNoWhiteSpace,
    textWords: words,
    text
  }
}

const getPdfText = async (pdfPath) => {
  const pdfData = await pdfTextExtract({ url: pdfPath })
  pdfData.pages = pdfData.pages.map(page => { return { pageNumber: page.pageNumber, textElements: getTextElements(page.textLines) } })
  const newPath = pdfPath.substring(0, pdfPath.lastIndexOf('.')) + '.json'
  writeFileSync(newPath, JSON.stringify(pdfData, null, 2))
}

module.exports = { getPdfText, hasTextElements, getTextElements }
