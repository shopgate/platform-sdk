const os = require('os')
const path = require('path')
const fsEx = require('fs-extra')
// @ts-check

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
   * @returns {Promise<string>}
   */
  async getToken () {
    const data = await this._loadSession()
    if (!data.token) throw new Error('You\'re not logged in! Please run `sgcloud login` again.')
    return data.token
  }

  /**
   * @param {string} token - JWT Session Token
   * @return {Promise<UserSettings>}
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
   * @param {string} token - JWT Session Token
   * @return {Session}
   */
  async setUsername (user) {
    const data = await this._loadSession()
    data.user = user
    await fsEx.ensureDir(this.settingsFolder)
    await fsEx.writeJson(this.sessionFile, data)
    return this
  }

  /**
   * @returns {Promise<Session>}
   * @private
   */
  async _loadSession () {
    try {
      return await fsEx.readJson(this.sessionFile) || {}
    } catch (err) {
      return {}
    }
  }
}

module.exports = UserSettings
