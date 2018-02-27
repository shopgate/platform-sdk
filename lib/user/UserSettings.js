const os = require('os')
const path = require('path')
const fsEx = require('fs-extra')
// @ts-check
/**
 * @class UserSettings
 */
class UserSettings {
  constructor () {
    this.settingsFolder = process.env.USER_PATH ? process.env.USER_PATH : path.join(os.homedir(), '.sgcloud')
    this.sessionFile = path.join(this.settingsFolder, 'session.json')
  }

  /**
   * @returns {UserSettings}
   */
  validate () {
    this.getToken()
    return this
  }

  /**
   * @returns {String}
   */
  getToken () {
    const data = this._loadSession()
    if (!data.token) throw new Error('You\'re not logged in! Please run `sgcloud login` again.')
    return data.token
  }

  /**
   * @param {String} token - JWT Session Token
   * @return {Session}
   */
  setToken (token) {
    const data = this._loadSession()
    data.token = token
    fsEx.ensureDirSync(this.settingsFolder)
    fsEx.writeJsonSync(this.sessionFile, data)
    return this
  }

  /**
   * @param {boolean} [validate=true]
   * @returns {Session}
   */
  _loadSession (validate = true) {
    return fsEx.readJsonSync(this.sessionFile, {throws: false}) || {}
  }
}

module.exports = UserSettings
