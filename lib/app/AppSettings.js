const path = require('path')
const fs = require('fs')
const logger = require('../logger')
const SETTINGS_FOLDER = '.sgcloud'
const SETTINGS_FILE = 'settings.json'
const EXTENSIONS_FILE = 'attachedExtensions.json'

let instance

class AppSettings {
  /**
   * @returns {AppSettings}
   */
  static getInstance () {
    if (!instance) instance = new AppSettings().init()
    return instance
  }

  static setInstance (appSettings) {
    instance = appSettings
  }

  constructor () {
    this.settingsFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, SETTINGS_FOLDER) : SETTINGS_FOLDER
    this.settingsFile = path.join(this.settingsFolder, SETTINGS_FILE)
    this.attachedExtensionsFile = path.join(this.settingsFolder, EXTENSIONS_FILE)
    this.attachedExtensions = {}
  }

  /**
   * @returns {string}
   */
  getId () {
    return this.id
  }

  /**
   * @param {string} id
   * @returns {AppSettings}
   */
  setId (id) {
    this.id = id
    return this
  }

  setAttachedExtensions (extensions) {
    this.attachedExtensions = extensions
    return this
  }

  /**
   * Attaches a extension
   * @param {string} pathName
   * @param {string} extensionId
   * @param {Boolean} [force=false]
   * @returns {AppSettings}
   */
  attachExtension (pathName, extensionId, force) {
    if (!force && this.attachedExtensions[extensionId]) {
      throw new Error(`Extension '${extensionId} (${pathName}) is already attached`)
    }

    logger.info(`Attached ${extensionId} (${pathName})`)
    this.attachedExtensions[extensionId] = {path: pathName}
    return this
  }

  /**
   * Detaches a extension
   * @param extensionId
   * @return {AppSettings}
   */
  detachExtension (extensionId) {
    if (!this.attachedExtensions[extensionId]) {
      logger.warn(`The extension '${extensionId}' is not attached`)
      return this
    }

    logger.info(`Detached ${extensionId}`)
    delete this.attachedExtensions[extensionId]
    return this
  }

  /**
   * Detaches all extensions
   */
  detachAllExtensions () {
    logger.info('Detached all extensions')
    this.attachedExtensions = {}
    return this
  }

  /**
   * @returns {AppSettings}
   */
  init () {
    try {
      const data = JSON.parse(fs.readFileSync(this.settingsFile))
      this.setId(data.id)
      const extensions = JSON.parse(fs.readFileSync(this.attachedExtensionsFile))
      this.setAttachedExtensions(extensions.attachedExtensions)
    } catch (err) {
      throw new Error('application not initialized')
    }

    if (!this.id || !this.attachedExtensions) throw new Error('application data invalid')

    return this
  }

  /**
   * @returns {AppSettings}
   */
  save () {
    fs.writeFileSync(this.settingsFile, JSON.stringify(this))
    fs.writeFileSync(this.attachedExtensionsFile, JSON.stringify({attachedExtensions: this.attachedExtensions}))
    return this
  }

  /**
   * @returns {object}
   */
  toJSON () {
    return {
      id: this.id
    }
  }
}

module.exports = AppSettings
module.exports.SETTINGS_FOLDER = SETTINGS_FOLDER
module.exports.EXTENSIONS_FILE = EXTENSIONS_FILE
