const path = require('path')
const fs = require('fs')
const SETTINGS_FOLDER = '.sgcloud'
const SETTINGS_FILE = 'settings.json'

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
   * @param {string} extension
   * @returns {AppSettings}
   */
  attachExtension (extension) {
    if (!this.attachedExtensions) {
      this.attachedExtensions = [extension]
      return this
    }

    const index = this.attachedExtensions.findIndex(ext => ext === extension)
    if (index === -1) {
      this.attachedExtensions.push(extension)
    }
    return this
  }

  /**
   * Detaches a extension
   * @param extension
   * @return {AppSettings}
   */
  detachExtension (extension) {
    // Delete all if extension is not defined
    if (!extension) {
      this.attachedExtensions = []
      return this
    }

    if (!this.attachedExtensions || !this.attachedExtensions.includes(extension)) {
      console.warn(`The extension '${extension}' is not attached`)
      return this
    }

    let extensionIndex = this.attachedExtensions.findIndex(ext => ext === extension)
    this.attachedExtensions.splice(extensionIndex, 1)
    return this
  }

  /**
   * @returns {AppSettings}
   */
  init () {
    try {
      const data = JSON.parse(fs.readFileSync(this.settingsFile))
      this.setId(data.id)
      this.setAttachedExtensions(data.attachedExtensions)
    } catch (err) {
      throw new Error('application not initialized')
    }

    if (!this.id) throw new Error('application data invalid')

    return this
  }

  /**
   * @returns {AppSettings}
   */
  save () {
    fs.writeFileSync(this.settingsFile, JSON.stringify(this))
    return this
  }

  /**
   * @returns {object}
   */
  toJSON () {
    return {
      id: this.id,
      attachedExtensions: this.attachedExtensions
    }
  }
}

module.exports = AppSettings
module.exports.SETTINGS_FOLDER = SETTINGS_FOLDER
module.exports.SETTINGS_FILE = SETTINGS_FILE
