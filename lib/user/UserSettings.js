const os = require('os')
const path = require('path')
const fsEx = require('fs-extra')

class UserSettings {
  constructor () {
    this.settingsFolder = process.env.USER_PATH ? process.env.USER_PATH : path.join(os.homedir(), '.sgcloud')
    this.sessionFile = path.join(this.settingsFolder, 'session.json')
  }

  async validate () {
    await this.getToken()
    return this
  }

  /**
   * @returns {String}
   */
  async getToken () {
    const data = await this._loadSession()
    if (!data.token) throw new Error('You\'re not logged in! Please run `sgcloud login` again.')
    return data.token
  }

  /**
   * @param {String} token - JWT Session Token
   * @return {Session}
   */
  async setToken (token) {
    const data = await this._loadSession()
    data.token = token
    await fsEx.ensureDir(this.settingsFolder)
    await fsEx.writeJson(this.sessionFile, data)
    return this
  }

  /**
   * @returns {String}
   */
  async getUsername () {
    const data = await this._loadSession()
    return !data.user ? undefined : data.user
  }

  /**
   * @param {String} token - JWT Session Token
   * @return {Session}
   */
  async setUsername (user) {
    const data = await this._loadSession()
    data.user = user
    await fsEx.ensureDir(this.settingsFolder)
    await fsEx.writeJson(this.sessionFile, data)
    return this
  }

  async _loadSession (validate = true) {
    return fsEx.readJson(this.sessionFile, {throws: false}) || {}
  }
}

module.exports = UserSettings
