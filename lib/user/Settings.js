const os = require('os')
const path = require('path')
const fs = require('fs')
const Session = require('./Session')

let instance

class Settings {
  /**
   * @returns {Settings}
   */
  static getInstance () {
    if (!instance) instance = new Settings()
    return instance
  }

  constructor () {
    this.settingsFolder = path.join(os.homedir(), '.sgcloud')
    this.sessionFile = path.join(this.settingsFolder, 'session')

    this.init()
  }

  /**
   * @returns {Settings}
   */
  init () {
    if (!fs.existsSync(this.settingsFolder)) fs.mkdirSync(this.settingsFolder)
    return this
  }

  /**
   * @returns {Settings}
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
        this.session = new Session(require(this.sessionFile))
      } else {
        this.session = new Session()
      }
    }

    return this.session
  }
}

module.exports = Settings
