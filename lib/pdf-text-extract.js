// Need the legacy build to work with Node - newer versions require Canvas to work, we don't want it.
// Variable-path require defeats TS's static resolution so it doesn't type-check the minified bundle.
const legacyPdfjsPath = 'pdfjs-dist/legacy/build/pdf.min.mjs'
/** @type {typeof import('pdfjs-dist')} */
const { getDocument } = require(legacyPdfjsPath)

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
    let currentLine = ''
    for (const [index, item] of Object.entries(txtContent.items)) {
      // Check if TextMarkedContent
      if (!('str' in item)) continue

      currentLine += item.str
      if (item.hasEOL || Number(index) === txtContent.items.length - 1) {
        // If end of textLine or end of page
        pageContent.textLines.push(currentLine)
        currentLine = ''
      }
    }
    pdfData.pages.push(pageContent)

    page.cleanup() // Cleanup resources
  }

  return pdfData
}

module.exports = { pdfTextExtract }
