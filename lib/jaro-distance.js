/**
 *
 * @param {string} s1 string to compare with s2
 * @param {string} s2 string to compare with s1
 * @param {Object} options
 * @param {boolean} [options.caseSensitive] default=true
 * @param {boolean} [options.verbose] default=false
 * @param {boolean} [options.factorLengthDifference] default=false
 * @returns {number} jaroScore
 */
const jaroDistance = (s1, s2, options) => {
  // Options
  if (!options) options = {}
  if (typeof options.caseSensitive !== 'boolean') options.caseSensitive = true

  if (!options.caseSensitive) {
    s1 = s1.toLowerCase()
    s2 = s2.toLowerCase()
  }
  // If the strings are equal
  if (s1 === s2) {
    return 1.0
  }

  // Length of input strings
  const len1 = s1.length
  const len2 = s2.length

  // Maximum distance upto which matching is allowed
  const maxMatchingDistance = Math.floor(Math.max(len1, len2) / 2) - 1 // Longest string's length / 2, rounded down to nearest integer, minus 1

  let matches = 0

  // Hash tables for matches
  const hashS1 = Array(len1).fill(0)
  const hashS2 = Array(len2).fill(0)

  // Traverse through the first string
  for (let i = 0; i < len1; i++) {
    // Check for matches
    for (let j = Math.max(0, i - maxMatchingDistance); j < Math.min(len2, i + maxMatchingDistance + 1); j++) {
      // If there is a match
      if (s1[i] === s2[j] && hashS2[j] === 0) {
        if (options.verbose) console.log(`i=${i} j=${j} - s1[i]=${s1[i]} matches s2[j]=${s2[j]}`)
        hashS1[i] = 1
        hashS2[j] = 1
        matches++
        break
      } else {
        if (options.verbose) console.log(`i=${i} j=${j} - s1[i]=${s1[i]} does not match s2[j]=${s2[j]}`)
      }
    }
  }

  if (matches === 0) return 0.0

  let transpositions = 0
  let point = 0

  // Count number of occurrences where two characters match but there is a third matched character in between the indices
  for (let i = 0; i < len1; i++) {
    if (hashS1[i]) { // there is a match on this character in s2
      if (options.verbose) console.log(`i=${i} point=${point} -  hashS1[i]=${hashS1[i]}`)
      // Find the next matched character in second string
      while (hashS2[point] === 0) { // As long as no match in s2 - increment point
        if (options.verbose) console.log(`i=${i} point=${point} - hashS2[point]=${hashS2[point]}`)
        point++
      }
      if (s1[i] !== s2[point++]) {
        if (options.verbose) console.log(`i=${i} point=${point} - s1[i]=${s1[i]} not equal to s2[point++]=${s2[point - 1]} - incrementing transpositions`)
        transpositions++
      } else {
        if (options.verbose) console.log(`i=${i} point=${point} - s1[i]=${s1[i]} equal to s2[point++]=${s2[point - 1]} - transpositions remains untouched`)
      }
    }
  }
  transpositions /= 2

  // Return Jaro Similarity
  if (options.verbose) console.log(`returning (${matches / len1}) + (${matches / len2}) + ((${matches - transpositions}) / ${matches}) / 3`)
  const jaroScore = ((matches / len1) + (matches / len2) + ((matches - transpositions) / matches)) / 3

  // Liten ekstra faktor for å gi lavere score til der lengden på strengene er veldig forskjellig - f. eks "Samarbeidsavtale mellom" og "Samarbeidsavtale mellom OT og NAV" vil bli "straffet" med litt mindre poeng, siden lengden er ganske forskjellig
  if (!options.factorLengthDifference) return jaroScore
  const lengthFactor = Math.abs(len1 - len2) / Math.max(len1, len2) / 10
  return jaroScore - lengthFactor
}

module.exports = { jaroDistance }
