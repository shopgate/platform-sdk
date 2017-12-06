const os = require('os')
const path = require('path')
const fsEx = require('fs-extra')

class UserSettings {
  constructor () {
    this.settingsFolder = process.env.USER_PATH ? process.env.USER_PATH : path.join(os.homedir(), '.sgcloud')
    this.sessionFile = path.join(this.settingsFolder, 'session.json')
  }

  validate () {
    this.getToken()
    return this
  }

  /**
   * @returns {String}
   */
  getToken () {
    const data = this._loadSession()
    if (!data.token) throw new Error('not logged in')
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

  _loadSession (validate = true) {
    return fsEx.readJsonSync(this.sessionFile, {throws: false}) || {}
  }
}

module.exports = UserSettings
