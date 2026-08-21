const { describe, test } = require("node:test")
const assert = require("node:assert/strict")
const { getProbableTitle } = require("../lib/title-check")

describe("getProbableTitle", () => {
  const zipcodes = [
    { Postnummer: "3260", Poststed: "Larvik" },
    { Postnummer: "3170", Poststed: "Sem" }
  ]

  test("returns null when all lines are too short to survive filtering", () => {
    const textLines = ["ab", "cd", ""]

    const result = getProbableTitle(textLines, [], zipcodes)

    assert.equal(result, null)
  })

  test("returns Known-title when a line matches a known title above the jaro threshold", () => {
    const knownTitles = [{ matchTextLine: "Søknad om skoleplass", title: "Søknad om skoleplass" }]
    const textLines = ["Søknad om skoleplass"]

    const result = getProbableTitle(textLines, knownTitles, zipcodes)

    assert.deepEqual(result, { title: "Søknad om skoleplass", type: "Known-title" })
  })

  test("returns Barnevern-sjekk with a fixed title when the line mentions barnevern", () => {
    const textLines = ["Vedtak i barnevernssak"]

    const result = getProbableTitle(textLines, [], zipcodes)

    assert.deepEqual(result, { title: "Trolig barnevernsdokument", type: "Barnevern-sjekk" })
  })

  test("skips lines that look like a person name and falls through to the next viable line", () => {
    const textLines = ["Ola Nordmann", "Referat fra møtet"]

    const result = getProbableTitle(textLines, [], zipcodes)

    assert.equal(result?.type, "Probable-title")
    assert.equal(result?.title, "Referat fra møtet")
  })

  test("skips lines containing both postnummer and poststed and falls through to the next viable line", () => {
    const textLines = ["3260 Larvik gata", "Møtereferat vår gjeng"]

    const result = getProbableTitle(textLines, [], zipcodes)

    assert.equal(result?.type, "Probable-title")
    assert.equal(result?.title, "Møtereferat vår gjeng")
  })
})
