require('dotenv').config()

module.exports = {
  BARCODE: {
    BARCODE_INPUT_DIR: process.env.BARCODE_INPUT_DIR,
    BARCODE_IMPORTED_DIR: process.env.BARCODE_IMPORTED_DIR,
    BARCODE_IMPORTED_TO_UNREG_DIR: process.env.BARCODE_IMPORTED_TO_UNREG_DIR
  },
  P360: {
    URL: process.env.P360_URL || 'fjdsoijfidsf.vtfk.no',
    AUTHKEY: process.env.P360_AUTHKEY || 'fjdsoijfidsf.vtfk.no',
  }
}