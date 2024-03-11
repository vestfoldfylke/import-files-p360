require('dotenv').config()

module.exports = {
  BARCODE: {
    BARCODE_INPUT_DIR: process.env.BARCODE_INPUT_DIR,
    BARCODE_IMPORTED_DIR: process.env.BARCODE_IMPORTED_DIR,
    BARCODE_IMPORTED_TO_UNREG_DIR: process.env.BARCODE_IMPORTED_TO_UNREG_DIR
  },
  UNREGISTERED: {
    INPUT_DIR: process.env.UNREGISTERED_INPUT_DIR,
    IMPORTED_DIR: process.env.UNREGISTERED_IMPORTED_DIR,
    FAILED_DIR: process.env.UNREGISTERED_FAILED_DIR,
    GET_AD_USER: process.env.UNREGISTERED_GET_AD_USER,
    AD_MAIN_COUNTY_OU: process.env.UNREGISTERED_AD_MAIN_COUNTY_OU
  },
  P360: {
    URL: process.env.P360_URL || 'fjdsoijfidsf.vtfk.no',
    AUTHKEY: process.env.P360_AUTHKEY || 'fjdsoijfidsf.vtfk.no',
  }
}