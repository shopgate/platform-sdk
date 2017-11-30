const fsEx = require('fs-extra')
const AppSettings = require('../../../AppSettings')
const path = require('path')

class Storage {
  constructor (log) {
    this.path = process.env.STORAGE_PATH || path.join(AppSettings.SETTINGS_FOLDER, 'storage.json')
    this.data = fsEx.readJsonSync(this.path, {throws: false}) || {}
    this.log = log
  }

  /**
   * @param {string} key
   * @param {function} cb
   */
  get (key, cb) {
    cb(null, this.data[key])
  }

  /**
   * @param {string} key
   * @param {*} value
   * @param {function} cb
   */
  set (key, value, cb) {
    this.data[key] = value
    cb()
    this.save()
  }

  /**
   * @param {string} key
   * @param {function} cb
   */
  del (key, cb) {
    delete this.data[key]
    cb()
    this.save()
  }

  /**
   * @private
   */
  save () {
    if (this.saving) {
      this.saveQueued = true
      return
    }

    this.saving = true
    setImmediate(() => fsEx.writeJson(this.path, this.data, this.saveCb))
  }

  /**
   * @private
   * @param err
   */
  saveCb (err) {
    if (err) this.log.error(err)
    this.saving = false
    if (!this.saveQueued) return
    this.saveQueued = false
    this.save()
  }
}

module.exports = Storage
