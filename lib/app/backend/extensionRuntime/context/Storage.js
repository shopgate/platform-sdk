const fsEx = require('fs-extra')
const path = require('path')

class Storage {
  constructor (appSettings, log) {
    this.path = process.env.STORAGE_PATH || path.join(appSettings.settingsFolder, 'storage.json')
    this.log = log
  }

  /**
   * @param {string} key
   * @param {function} cb
   */
  get (key, cb) {
    this._loadStorage((result) => cb(null, result[key]))
  }

  /**
   * @param {string} key
   * @param {*} value
   * @param {function} cb
   */
  set (key, value, cb) {
    this._loadStorage((result) => {
      result[key] = value
      fsEx.writeJSON(this.path, result, {spaces: 2}, cb)
    })
  }

  /**
   * @param {string} key
   * @param {function} cb
   */
  del (key, cb) {
    this._loadStorage((result) => {
      delete result[key]
      fsEx.writeJSON(this.path, result, {spaces: 2}, cb)
    })
  }

  _loadStorage (cb) {
    fsEx.readJSON(this.path, {}, (err, result) => {
      if (err) {
        if (process.env['LOG_LEVEL'] === 'debug') this.log.debug(`Can't read storage file: ${err}`)
        result = {}
      }
      cb(result)
    })
  }
}

module.exports = Storage
