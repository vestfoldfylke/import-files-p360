const { readFileSync, existsSync, statSync, mkdirSync, renameSync, readdirSync } = require('fs')
const path = require('path')

const getFilesInDir = dir => {
  if (!existsSync(dir)) throw new Error(`Directory ${dir} does not exist`)
  const files = [] 
  readdirSync(dir).forEach(file => {
    if (!statSync(`${dir}/${file}`).isDirectory()) files.push(`${dir}/${file}`)
  })
  return files
}

const moveToDir = (filePath, dir) => {
  if (!filePath || !dir) throw new Error('Missing required parameters "filePath" and/or "dir"')
  if (!existsSync(dir)) mkdirSync(dir)
  renameSync(filePath, `${dir}/${path.basename(filePath)}`)
}

/**
 * @typedef FileMetadata
 * @property {string} filePath
 * @property {string} fileName
 * @property {string} fileExt
 * @property {string} fileNameWithoutExt
 * @property {Date} createdTimestamp
 * @property {Date} modifiedTimestamp
 */

/**
 * 
 * @param {string} filePath 
 * @returns {FileMetadata} fileMetadata
 */
const getFileMetadataFromPath = (filePath) => {
  const filenameList = filePath.split('/')
  const fileName = filenameList[filenameList.length - 1]
  const fileExt = fileName.substring(fileName.lastIndexOf('.') + 1, fileName.length)
  const fileNameWithoutExt = fileName.substring(0, fileName.length - fileExt.length - 1)
  const fileStat = statSync(filePath)
  return {
    filePath,
    fileName,
    fileExt,
    fileNameWithoutExt,
    createdTimestamp: fileStat.birthtime,
    modifiedTimestamp: fileStat.mtime
  }
}

/**
 * 
 * @param {string} dir
 * @param {string} [ext] if you only want files with a certain extension 
 * @returns {FileMetadata[]}
 */
const getFilesInDirWithMetadata = (dir, ext) => {
  const files = getFilesInDir(dir).map(file => getFileMetadataFromPath(file))
  if (ext) {
    ext = ext.replace('.', '').trim()
    return files.filter(file => file.fileExt === ext)
  }
  return files
}

module.exports = { getFilesInDir, moveToDir, getFilesInDirWithMetadata }
