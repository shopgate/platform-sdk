const path = require('path')
const fsEx = require('fs-extra')
const config = require('../../lib/config')
// @ts-check

class UserSettings {
  constructor () {
    this.settingsFolder = config.get('userSettingsDirectory') || path.join(config.get('userDirectory'), '.sgcloud')
    this.sessionFile = path.join(this.settingsFolder, 'session.json')
    this.userData = null
  }

  /**
   * @returns {Promise<UserSettings>}
   */
  async validate () {
    await this.getToken()
    return this
  }

  /**
   * @returns {Promise<string>}
   */
  async getToken () {
    const data = await this._loadSession()
    if (!data.token) throw new Error('You\'re not logged in! Please run `sgconnect login` again.')
    return data.token
  }

  /**
   * @param {string} token - JWT Session Token
   * @return {Promise<UserSettings>}
   */
  async setToken (token) {
    const data = await this._loadSession()
    data.token = token
    await this._updateSession(data)
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
   * @param {String} user The user name, i.e. email address
   * @return {UserSettings}
   */
  async setUsername (user) {
    const data = await this._loadSession()
    data.user = user
    await this._updateSession(data)
    return this
  }

  /**
   * @returns {Promise<Object>} The user / session data
   * @private
   */
  async _loadSession () {
    if (this.userData) return this.userData

    try {
      this.userData = await fsEx.readJson(this.sessionFile) || {}
      return this.userData
    } catch (err) {
      return {}
    }
  }

  /**
   * @param {Object} data
   * @returns {Promise<void>}
   * @private
   */
  async _updateSession (data) {
    await fsEx.ensureDir(this.settingsFolder)
    await fsEx.writeJson(this.sessionFile, data)
    this.userData = data
  }
}

module.exports = UserSettings
