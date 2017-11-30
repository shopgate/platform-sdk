const os = require('os')
const path = require('path')
const fsEx = require('fs-extra')
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

  static setInstance (userSettings) {
    instance = userSettings
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
    return this
  }

  /**
   * @returns {UserSettings}
   */
  save () {
    fsEx.ensureDirSync(this.settingsFolder)
    fsEx.writeJsonSync(this.sessionFile, this.getSession())
    return this
  }

  /**
   * @returns {Session}
   */
  getSession () {
    if (!this.session) {
      this.session = new Session(fsEx.readJsonSync(this.sessionFile, {throws: false}) || {})
    }

    return this.session
  }
}

module.exports = UserSettings
