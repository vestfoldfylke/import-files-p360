const axios = require('axios').default
const { P360 } = require('../config')
const fs = require('fs')

/**
 * 
 * @param {Object} metadata 
 * @param {string} metadata.filename
 * @param {string} metadata.msg
 * @param {string} metadata.ext
 * @param {string} metadata.origin
 * @param {string} metadata.filepath
 * @returns Result
 */
const createUnregMetadata = (metadata) => {
  if (!(metadata.filename && metadata.msg && metadata.ext && metadata.origin && metadata.filepath)) throw new Error('Missing required properties in metadata (required: filename, msg, ext, origin, filepath)')
  const res = {
    parameter: {
      Archive: '7',
      Title: metadata.filename,
      DocumentDate: '2019-10-09T06:46:05.952Z',
      Category: 'I',
      Status: 'J',
      AccessCode: '',
      AccessGroup: 'Alle',
      UnregisteredContacts: [
        {
          Role: '6',
          ContactName: metadata.msg,
          ContactCompanyName: metadata.msg
        }
      ],
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
  return res
}

/**
 * 
 * @param {Object} metadata 
 * @param {string} metadata.filename
 * @param {string} metadata.msg
 * @param {string} metadata.ext
 * @param {string} metadata.origin
 * @param {string} metadata.filepath
 * @returns Result
 */
const sendToUnreg = async (metadata) => {
  const payload = createUnregMetadata(metadata)
  const url = `${P360.URL}/DocumentService/CreateDocument?authkey=${P360.AUTHKEY}`

  const res = await axios.post(url, payload)
  if (res.data.Successful) {
    return res.data
  } else {
    throw new Error(res.data.ErrorMessage)
  }
}

const getDocumentData = async (recno) => {
  const payload = {
    Recno: recno
  }
  const url = `${P360.URL}/DocumentService/GetDocuments?authkey=${P360.AUTHKEY}`
  const res = await axios.post(url, payload)
  if (res.data.Successful) {
    return res.data
  } else {
    throw new Error(res.data.ErrorMessage)
  }
}

/**
 * 
 * @param {Object} metadata 
 * @param {string} metadata.filename
 * @param {string} metadata.msg
 * @param {string} metadata.ext
 * @param {string} metadata.origin
 * @param {string} metadata.filepath
 * @returns Result
 */
const sendToDocument = async (barcodeData, file) => {
  let fileTitle
  if (barcodeData.docType === 'HOVED') {
    const docData = await getDocumentData(barcodeData.docRecno)
    // Hvis det ligger filer i dokumentet allerede - ikke sett hoved, legg til som vedlegg
    if (docData.Documents.length === 0) throw new Error(`Document with recno ${barcodeData.docRecno} does not exist...`)
    if (docData.Documents[0].Files.length > 0) {
      fileTitle = "Vedlegg"
    } else {
      fileTitle = docData.Documents[0].OfficialTitle.replace(/[^a-zA-Z0-9æøåÆØÅ ]/gi, ' ').replace('  ', ' ').trim() // Frekk versjon som fikser det meste // replace(/[/\\?%*:|"<>-]/g, '-').trim() // SIF doesn't like ugly bugly characters in file titles
    }
  } else {
    fileTitle = "Vedlegg"
  }
  const payload = {
    DocumentNumber: `recno:${barcodeData.docRecno}`,
    Files: [
      {
        Title: fileTitle,
        Format: file.fileExt,
        Base64Data: Buffer.from(fs.readFileSync(file.filePath)).toString('base64'),
        VersionFormat: "A"
      }
    ]
  }
  const url = `${P360.URL}/DocumentService/UpdateDocument?authkey=${P360.AUTHKEY}`
  const res = await axios.post(url, payload)
  if (res.data.Successful) {
    return res.data
  } else {
    throw new Error(res.data.ErrorMessage)
  }
}

module.exports = { sendToUnreg, createUnregMetadata, sendToDocument }