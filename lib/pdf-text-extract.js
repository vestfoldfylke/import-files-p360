// Need the legacy build to work with Node - newer versions require Canvas to work, we don't want it
const { getDocument } = require('pdfjs-dist/legacy/build/pdf.min.mjs')

/**
 * @typedef {Object} Metadata
 * @property {Object} info PDF format and creator and stuff
 * @property {import('pdfjs-dist/types/src/display/metadata')} metadata
 * @property {*} [contentDispositionFilename]
 * @property {number} [contentLength]
 * @property {number} numPages Total number of pages in the PDF file.
 */

/**
 * @typedef {Object} TextStyle
 * @extends {import('pdfjs-dist/types/src/display/api').TextStyle'}
 * @property {string} fontName id/name of the font - corresponding to fontName in strings array
 */

/**
 * @typedef {Object} TextItem
 * @extends {import('pdfjs-dist/types/src/display/api').TextItem'}
 * @property {string} fontName id of the font - corresponding to fontName in strings array
 */

/**
 * @typedef {Object} PdfContent
 * @property {Metadata} metadata
 * @property {Object[]} pages
 * @property {number} pages.pageNumber
 * @property {string[]} pages.textLines
 * @property {import('pdfjs-dist/types/src/display/api').TextItem[]} pages.textItems
 * @property {TextStyle[]} styles
 */

/**
 This is the main entry point for loading a PDF and interacting with it.
 *
 * NOTE: If a URL is used to fetch the PDF data a standard Fetch API call (or
 * XHR as fallback) is used, which means it must follow same origin rules,
 * e.g. no cross-domain requests without CORS.
 * @param {import('pdfjs-dist/types/src/display/api').GetDocumentParameters} pdf Can be a URL where a PDF file is located, a typed array (Uint8Array) already populated with data, or a parameter object.
 * @returns {Promise<PdfContent>}
 */
const pdfTextExtract = async (pdf) => {
  const pdfData = {
    metadata: null,
    pages: [],
    styles: []
  }
  const loadingTask = getDocument(pdf)
  const doc = await loadingTask.promise
  pdfData.metadata = await doc.getMetadata()
  pdfData.metadata.numPages = doc.numPages

  for (let pageNum = 1; pageNum <= pdfData.metadata.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const pageContent = {
      pageNumber: pageNum,
      textLines: [],
      textItems: []
    }

    const txtContent = await page.getTextContent()
    let currentLine = ''
    for (const [index, item] of Object.entries(txtContent.items)) {
      pageContent.textItems.push(item)
      currentLine += item.str
      if (item.hasEOL || Number(index) === txtContent.items.length - 1) {
        // If end of textLine or end of page
        pageContent.textLines.push(currentLine)
        currentLine = ''
      }
    }
    pdfData.pages.push(pageContent)

    // Add styles as well
    for (const [fontName, style] of Object.entries(txtContent.styles)) {
      if (!pdfData.styles.find((style) => style.fontName === fontName)) pdfData.styles.push({ fontName, ...style })
    }
    page.cleanup() // Cleanup resources
  }

  return pdfData
}

module.exports = { pdfTextExtract }
