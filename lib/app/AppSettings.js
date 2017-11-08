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
   * attaches multiple extensions
   * @param {String[]} extensions
   * @param {Boolean} [force=false]
   * @return {AppSettings}
   */
  attachExtensions (extensions, force) {
    extensions.forEach(extension => this.attachExtension(extension, force))
    return this
  }

  /**
   * Attaches a extension
   * @param {string} extension
   * @param {Boolean} [force=false]
   * @returns {AppSettings}
   */
  attachExtension (extension, force) {
    if (!force && this.attachedExtensions[extension]) {
      throw new Error(`Extension '${extension} is already attached`)
    }

    logger.info(`Attached ${extension}`)
    this.attachedExtensions[extension] = {id: extension}
    return this
  }

  /**
   * Detaches multiple extensions
   * @param extensions
   */
  detachExtensions (extensions) {
    extensions.forEach(extension => this.detachExtension(extension))
    return this
  }

  /**
   * Detaches a extension
   * @param extension
   * @return {AppSettings}
   */
  detachExtension (extension) {
    if (!this.attachedExtensions[extension]) {
      logger.warn(`The extension '${extension}' is not attached`)
      return this
    }

    logger.info(`Detached ${extension}`)
    delete this.attachedExtensions[extension]
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
