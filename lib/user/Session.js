const path = require('path')
const fsEx = require('fs-extra')

class Session {
  /**
   * @param {Object} [data]
   * @param {String} [data.token] - JWT Session Token
   */
  constructor (settingsFolder) {
    this.settingsFolder = settingsFolder
    this.sessionFile = path.join(this.settingsFolder, 'session.json')
  }

  /**
   * @returns {String}
   */
  getToken () {
    return this._loadSession().token
  }

  /**
   * @param {String} token - JWT Session Token
   * @return {Session}
   */
  setToken (token) {
    const data = this._loadSession()
    data.token = token
    return this._saveSession(data)
  }

  _loadSession () {
    return fsEx.readJsonSync(this.sessionFile, {throws: false}) || {}
  }

  _saveSession (session) {
    fsEx.ensureDirSync(this.settingsFolder)
    fsEx.writeJsonSync(this.sessionFile, session)
    return this
  }
}

module.exports = Session
