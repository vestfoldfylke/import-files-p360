const { describe, test } = require("node:test")
const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")
const { pdfTextExtract } = require("../lib/pdf-text-extract")

describe("pdfTextExtract loaded by URL", () => {
  test("example-pdf.pdf (one page, one column, mixed styling) exposes the expected line on page 1", async () => {
    const pdfData = await pdfTextExtract({
      url: "./tests/data/example-pdf.pdf",
      verbosity: 0,
    })

    assert.equal(pdfData.pages[0].textLines[4], "SOME Larger TEXT")
  })

  test("example-pdf-2.pdf (two pages, two columns, vertical text) exposes the expected line on page 2", async () => {
    const pdfData = await pdfTextExtract({
      url: "./tests/data/example-pdf-2.pdf",
      verbosity: 0,
    })

    assert.equal(pdfData.pages[1].textLines[1], "maybe not if the text is really malformed")
  })
})

describe("pdfTextExtract loaded from Uint8Array", () => {
  test("example-pdf-2.pdf produces the same line on page 2 as the URL path", async () => {
    const buff = readFileSync("./tests/data/example-pdf-2.pdf")
    const uint8Arr = new Uint8Array(buff)
    const pdfData = await pdfTextExtract({ data: uint8Arr, verbosity: 0 })

    assert.equal(pdfData.pages[1].textLines[1], "maybe not if the text is really malformed")
  })
})
