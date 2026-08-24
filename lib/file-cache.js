const crypto = require("node:crypto")
const { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } = require("node:fs")
const { logger } = require("@vestfoldfylke/loglady")

/**
 * @template [T=unknown]
 */
class FileCache {
  /**
   * @param {string} cachePath Relative path starting with "./"
   */
  constructor(cachePath) {
    if (!cachePath.startsWith("./")) {
      throw new Error('Cache path must be a relative path starting with "./"')
    }
    this.cachePath = cachePath
  }

  /**
   * @param {string} cacheKey
   * @returns {string}
   */
  #cacheKeyToHash(cacheKey) {
    if (typeof cacheKey !== "string") {
      throw new Error("Cache key must be a string")
    }
    return crypto.createHash("md5").update(cacheKey).digest("hex")
  }

  /**
   * @param {string} cacheKey
   * @returns {T | null}
   */
  get(cacheKey) {
    if (!existsSync(`${this.cachePath}/${this.#cacheKeyToHash(cacheKey)}.json`)) {
      return null
    }

    try {
      const cachedData = JSON.parse(readFileSync(`${this.cachePath}/${this.#cacheKeyToHash(cacheKey)}.json`, "utf-8"))

      if (Date.now() > new Date(cachedData.expiry).getTime()) {
        logger.info(`FileCache - cached data for key: {cacheKey} is expired, will have to fetch and generate data`, cacheKey)
        unlinkSync(`${this.cachePath}/${this.#cacheKeyToHash(cacheKey)}.json`)
        return null
      }

      return cachedData.data
    } catch (error) {
      logger.errorException(error, `FileCache - Error while trying to read cache for key: "${cacheKey}", will have to fetch and generate data. Deleting cache file just in case`)

      try {
        unlinkSync(`${this.cachePath}/${this.#cacheKeyToHash(cacheKey)}.json`)
      } catch (error) {
        logger.errorException(error, `FileCache - Error while trying to delete cache file for key: "${cacheKey}".`)
      }

      return null
    }
  }

  /**
   * @param {string} cacheKey
   * @param {T} data
   * @param {number} ttl Time-to-live in seconds
   */
  set(cacheKey, data, ttl) {
    try {
      if (typeof ttl !== "number" || Number.isNaN(ttl) || ttl <= 0) {
        throw new Error("TTL (time-to-live) must be a positive number")
      }

      const expiry = new Date(Date.now() + ttl * 1000).toISOString()
      const cacheData = {
        expiry,
        data
      }

      try {
        if (!existsSync(this.cachePath)) {
          logger.info(`FileCache - cache directory does not exist, creating directory at path: "${this.cachePath}"`)
          mkdirSync(this.cachePath, { recursive: true })
        }

        writeFileSync(`${this.cachePath}/${this.#cacheKeyToHash(cacheKey)}.json`, JSON.stringify(cacheData))
      } catch (error) {
        logger.errorException(error, `FileCache - Error while trying to write cache file for key: "${cacheKey}".`)
        return null
      }
    } catch (error) {
      logger.errorException(error, `FileCache - Could not set cache data for key: "${cacheKey}", will have to try again next time :(`)
    }
  }
}

module.exports = { FileCache }
