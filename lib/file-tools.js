const { logger } = require('@vtfk/logger')
const { existsSync, statSync, mkdirSync, renameSync, readdirSync, unlinkSync } = require('fs')
const path = require('path')

const getFilesInDir = dir => {
  if (!existsSync(dir)) throw new Error(`Directory ${dir} does not exist`)
  const files = []
  readdirSync(dir).forEach(file => {
    if (!statSync(`${dir}/${file}`).isDirectory()) files.push(`${dir}/${file}`)
  })
  return files
}

const moveToDir = (filePath, dir, newFileName) => {
  if (!filePath || !dir) throw new Error('Missing required parameters "filePath" and/or "dir"')
  if (!existsSync(dir)) mkdirSync(dir)
  let fileName
  if (newFileName) {
    const fileExt = filePath.substring(filePath.lastIndexOf('.') + 1, filePath.length)
    fileName = `${newFileName}.${fileExt}`
  } else {
    fileName = path.basename(filePath)
  }
  renameSync(filePath, `${dir}/${fileName}`)
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

/**
 *
 * @param {string} dir
 * @param {number} deleteAfterDays
 * @param {string} [ext] if you only want to delete files with a certain extension
 */
const deleteOldFiles = (dir, deleteAfterDays, ext) => {
  const files = getFilesInDirWithMetadata(dir, ext)
  logger('info', [`Deleting files older than ${deleteAfterDays} days in ${dir} - checking ${files.length} number of files`])
  const now = new Date()
  let deletedFiles = 0
  let sparedFiles = 0
  let failedDeletions = 0
  for (const file of files) {
    const daysOld = Math.floor((now - file.modifiedTimestamp) / (1000 * 60 * 60 * 24)) // No worries with daylightsavings here :) We can live with a day from or to
    if (daysOld > deleteAfterDays) {
      try {
        // logger('info', [`File is over ${deleteAfterDays} old - deleting`, file.fileName])
        unlinkSync(file.filePath)
        deletedFiles++
      } catch (error) {
        failedDeletions++
        logger('warn', ['Oh no! File should have died, but survived! Will live to see another day (or some minutes)', file.fileName])
      }
    } else {
      sparedFiles++
      // logger('info', [`File is underage (${daysOld} days old) - will keep it on life support`, file.fileName])
    }
  }
  logger('info', [`Finished deleting files. Deleted: ${deletedFiles} - Spared files: ${sparedFiles} - Failed deletions: ${failedDeletions}`])
}

module.exports = { getFilesInDir, moveToDir, getFilesInDirWithMetadata, deleteOldFiles }
