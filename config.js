require('dotenv').config()

module.exports = {
  COUNTY_NUMBER: process.env.COUNTY_NUMBER,
  TEST_TITLES_INPUT_DIR: process.env.TEST_TITLES_INPUT_DIR || './tests/local-data/test-titles',
  TEST_TITLES_OUTPUT_DIR: process.env.TEST_TITLES_OUTPUT_DIR || './tests/local-data/test-titles/result',
  BARCODE: {
    INPUT_DIR: process.env.BARCODE_INPUT_DIR,
    IMPORTED_DIR: process.env.BARCODE_IMPORTED_DIR,
    IMPORTED_TO_UNREG_DIR: process.env.BARCODE_IMPORTED_TO_UNREG_DIR,
    IMPORTED_AFTER_DAYS: process.env.BARCODE_DELETE_IMPORTED_AFTER_DAYS || 30
  },
  UNREGISTERED: {
    INPUT_DIR: process.env.UNREGISTERED_INPUT_DIR,
    IMPORTED_DIR: process.env.UNREGISTERED_IMPORTED_DIR,
    FAILED_DIR: process.env.UNREGISTERED_FAILED_DIR,
    GET_AD_USER: process.env.UNREGISTERED_GET_AD_USER && process.env.UNREGISTERED_GET_AD_USER === 'true' || false,
    AD_MAIN_COUNTY_OU: process.env.UNREGISTERED_AD_MAIN_COUNTY_OU,
    DELETE_IMPORTED_AFTER_DAYS: process.env.UNREGISTERED_DELETE_IMPORTED_AFTER_DAYS || 30
  },
  APPREG: {
    CLIENT_ID: process.env.APPREG_CLIENT_ID,
    CLIENT_SECRET: process.env.APPREG_CLIENT_SECRET,
    TENANT_ID: process.env.APPREG_TENANT_ID,
  },
  ARCHIVE: {
    URL: process.env.ARCHIVE_URL,
    SCOPE: process.env.ARCHIVE_SCOPE
  },
  VITNEMAL: {
    INPUT_DIR: process.env.VITNEMAL_INPUT_DIR
  },
  KOMPETANSEBEVIS: {
    INPUT_DIR: process.env.KOMPETANSEBEVIS_INPUT_DIR
  },
  P360: {
    URL: process.env.P360_URL || 'fjdsoijfidsf.vtfk.no',
    AUTHKEY: process.env.P360_AUTHKEY || 'fjdsoijfidsf.vtfk.no',
  }
}