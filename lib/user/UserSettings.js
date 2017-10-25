const os = require('os')
const path = require('path')
const fs = require('fs')
const Session = require('./Session')

let instance

class UserSettings {
  /**
   * @returns {UserSettings}
   */
  static getInstance () {
    if (!instance) instance = new UserSettings()
    return instance
  }

  static setInstance (appSettings) {
    instance = appSettings
  }

  constructor () {
    this.settingsFolder = process.env.USER_PATH ? process.env.USER_PATH : path.join(os.homedir(), '.sgcloud')

    this.init()
  }

  /**
   * @returns {UserSettings}
   */
  init () {
    this.sessionFile = path.join(this.settingsFolder, 'session.json')

    if (!fs.existsSync(this.settingsFolder)) fs.mkdirSync(this.settingsFolder)
    this.sessionFile = path.join(this.settingsFolder, 'session.json')
    return this
  }

  /**
   * @returns {UserSettings}
   */
  save () {
    fs.writeFileSync(this.sessionFile, JSON.stringify(this.getSession()))
    return this
  }

  /**
   * @returns {Session}
   */
  getSession () {
    if (!this.session) {
      if (fs.existsSync(this.sessionFile)) {
        this.session = new Session(JSON.parse(fs.readFileSync(this.sessionFile)))
      } else {
        this.session = new Session()
      }
    }

    return this.session
  }
}

module.exports = UserSettings
