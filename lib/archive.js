const fs = require('fs')
const { callArchive } = require('./call-archive')

/**
 *
 * @param {Object} metadata
 * @param {string} metadata.filename
 * @param {string} metadata.note
 * @param {string} metadata.ext
 * @param {string} metadata.origin
 * @param {string} metadata.filepath
 * @returns Result
 */
const sendToUnreg = async (metadata) => {
  if (!(metadata.filename && metadata.note && metadata.ext && metadata.origin && metadata.filepath)) throw new Error('Missing required properties in metadata (required: filename, note, ext, origin, filepath)')
  const archiveMetadata = {
    service: 'DocumentService',
    method: 'CreateDocument',
    parameter: {
      Archive: '7',
      Title: metadata.filename,
      DocumentDate: '2019-10-09T06:46:05.952Z',
      Category: 'Dokument inn',
      Status: 'J',
      AccessCode: '',
      AccessGroup: 'Alle',
      Notes: metadata.note,
      JournalDate: '2019-10-09T06:46:05.952Z',
      DispatchedDate: '2019-10-09T06:46:05.952Z',
      Files: [
        {
          Title: metadata.filename,
          Format: metadata.ext,
          Base64Data: Buffer.from(fs.readFileSync(metadata.filepath)).toString('base64')
        }
      ],
      AdditionalFields: [
        {
          Name: 'Committed',
          Value: '-1'
        },
        {
          Name: 'ToOrigin',
          Value: metadata.origin
        }
      ]
    }
  }
  const archiveRes = await callArchive('archive', archiveMetadata)
  return archiveRes
}

const getDocumentData = async (recno) => {
  const payload = {
    service: 'DocumentService',
    method: 'GetDocuments',
    parameter: {
      Recno: recno
    }
  }
  const getDocumentRes = await callArchive('archive', payload)
  return getDocumentRes
}

const sendToDocument = async (barcodeData, file) => {
  let fileTitle
  if (barcodeData.docType === 'HOVED') {
    const docData = await getDocumentData(barcodeData.docRecno)
    // Hvis det ligger filer i dokumentet allerede - ikke sett hoved, legg til som vedlegg
    if (docData.length === 0) throw new Error(`Document with recno ${barcodeData.docRecno} does not exist...`)
    if (docData[0].Files.length > 0) {
      fileTitle = 'Vedlegg'
    } else {
      fileTitle = docData[0].Title.replace(/[^a-zA-Z0-9æøåÆØÅ. ]/gi, ' ').replace('  ', ' ').trim() // Frekk versjon som fikser det meste // replace(/[/\\?%*:|"<>-]/g, '-').trim() // SIF doesn't like ugly bugly characters in file titles
    }
  } else {
    fileTitle = 'Vedlegg'
  }
  const payload = {
    service: 'DocumentService',
    method: 'UpdateDocument',
    parameter: {
      DocumentNumber: `recno:${barcodeData.docRecno}`,
      Files: [
        {
          Title: fileTitle,
          Format: file.fileExt,
          Base64Data: Buffer.from(fs.readFileSync(file.filePath)).toString('base64'),
          VersionFormat: 'A'
        }
      ]
    }
  }
  const updateDocumenRes = await callArchive('archive', payload)
  return updateDocumenRes
}

module.exports = { sendToUnreg, sendToDocument }
