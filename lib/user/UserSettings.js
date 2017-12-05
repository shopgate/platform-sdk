const os = require('os')
const path = require('path')
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
    this.session = new Session(this.settingsFolder)
  }

  /**
   * @returns {Session}
   */
  getSession () {
    return this.session
  }
}

module.exports = UserSettings
