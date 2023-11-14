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

const getFileMetadataFromPath = (filePath) => {
  const filenameList = filePath.split('/')
  const fileName = filenameList[filenameList.length - 1]
  const fileExt = fileName.substring(fileName.lastIndexOf('.') + 1, fileName.length)
  const fileNameWithoutExt = fileName.substring(0, fileName.length - fileExt.length - 1)
  return {
    filePath,
    fileName,
    fileExt,
    fileNameWithoutExt
  }
}

const getFilesInDirWithMetadata = (dir) => {
  const files = getFilesInDir(dir).map(file => getFileMetadataFromPath(file))
  return files
}

module.exports = { getFilesInDir, moveToDir, getFilesInDirWithMetadata }
