const path = require('path')
const fs = require('fs')
const FrontendSettings = require('./frontend/FrontendSettings')
const SETTINGS_FOLDER = '.sgcloud'
const SETTINGS_APP_FILE = 'app.json'
const SETTINGS_FRONTEND_FILE = 'frontend.json'

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
    this.settingsFile = path.join(this.settingsFolder, SETTINGS_APP_FILE)
    this.frontendSettingsFile = path.join(this.settingsFolder, SETTINGS_FRONTEND_FILE)
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

  /**
   * @returns {AppSettings}
   */
  init () {
    try {
      const data = JSON.parse(fs.readFileSync(this.settingsFile))
      this.setId(data.id)
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
    fs.writeFileSync(this.frontendSettingsFile, JSON.stringify(this.getFrontendSettings()))
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

  getFrontendSettings () {
    if (!this.frontendSettings) {
      if (fs.existsSync(this.frontendSettingsFile)) {
        this.frontendSettings = new FrontendSettings(JSON.parse(fs.readFileSync(this.frontendSettingsFile)))
      } else {
        this.frontendSettings = new FrontendSettings()
      }
    }

    return this.frontendSettings
  }
}

module.exports = AppSettings
module.exports.SETTINGS_FOLDER = SETTINGS_FOLDER
