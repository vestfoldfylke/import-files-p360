// Need the legacy build to work with Node - newer versions require Canvas to work, we don't want it.
// Variable-path require defeats TS's static resolution so it doesn't type-check the minified bundle.
const legacyPdfjsPath = "pdfjs-dist/legacy/build/pdf.min.mjs"

// pdfjs prints DOM-polyfill warnings at module init when running under Node.
// They're expected (we intentionally skip Canvas) and just add noise.
// Suppress unless the caller opts in via VERBOSE=true.
const PDFJS_INIT_NOISE = ["Cannot access the `require` function", "Cannot polyfill `DOMMatrix`", "Cannot polyfill `ImageData`", "Cannot polyfill `Path2D`"]
// pdfjs writes these warnings via `console.log("Warning: ...")` (not warn),
// so we intercept both channels while requiring the module.
const originalConsoleLog = console.log
const originalConsoleWarn = console.warn
const suppressPdfjsNoise = process.env.VERBOSE !== "true"
/** @param {unknown[]} args */
const isPdfjsNoise = (args) => {
  const firstArg = args[0]
  const message = typeof firstArg === "string" ? firstArg : ""
  return PDFJS_INIT_NOISE.some((pattern) => message.includes(pattern))
}
if (suppressPdfjsNoise) {
  console.log = (...args) => {
    if (isPdfjsNoise(args)) {
      return
    }
    originalConsoleLog(...args)
  }
  console.warn = (...args) => {
    if (isPdfjsNoise(args)) {
      return
    }
    originalConsoleWarn(...args)
  }
}

/** @type {typeof import('pdfjs-dist')} */
const { getDocument } = require(legacyPdfjsPath)

if (suppressPdfjsNoise) {
  console.log = originalConsoleLog
  console.warn = originalConsoleWarn
}

/**
 * @typedef {Object} PdfContent
 * @property {Object[]} pages
 * @property {number} pages.pageNumber
 * @property {string[]} pages.textLines
 */

/**
 This is the main entry point for loading a PDF and interacting with it.
 *
 * NOTE: If a URL is used to fetch the PDF data a standard Fetch API call (or
 * XHR as fallback) is used, which means it must follow same origin rules,
 * e.g. no cross-domain requests without CORS.
 * @param {import('pdfjs-dist/types/src/display/api').DocumentInitParameters} pdf Can be a URL where a PDF file is located, a typed array (Uint8Array) already populated with data, or a parameter object.
 * @returns {Promise<PdfContent>}
 */
const pdfTextExtract = async (pdf) => {
  /** @type {import('pdfjs-dist/types/src/display/api').PDFDocumentLoadingTask} */
  const loadingTask = getDocument(pdf)
  const doc = await loadingTask.promise

  /** @type {PdfContent} */
  const pdfData = {
    pages: []
  }

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)

    /** @type {PdfContent['pages'][number]} */
    const pageContent = {
      pageNumber: pageNum,
      textLines: []
    }

    const txtContent = await page.getTextContent()
    let currentLine = ""
    for (const [index, item] of Object.entries(txtContent.items)) {
      // Check if TextMarkedContent
      if (!("str" in item)) {
        continue
      }

      currentLine += item.str
      if (item.hasEOL || Number(index) === txtContent.items.length - 1) {
        // If end of textLine or end of page
        pageContent.textLines.push(currentLine)
        currentLine = ""
      }
    }
    pdfData.pages.push(pageContent)

    page.cleanup() // Cleanup resources
  }

  return pdfData
}

module.exports = { pdfTextExtract }
