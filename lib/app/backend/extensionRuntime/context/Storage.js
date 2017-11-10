const fsExtra = require('fs-extra')
const AppSettings = require('../../../AppSettings')
const path = require('path')

class Storage {
  constructor (log) {
    this.path = process.env.STORAGE_PATH || path.join(AppSettings.SETTINGS_FOLDER, 'storage.json')
    this.data = fsExtra.readJsonSync(this.path, {throws: false}) || {}
    this.log = log
  }

  /**
   * @param {string} key
   * @param {function} cb
   * @returns {Storage}
   */
  get (key, cb) {
    cb(null, this.data[key])
    return this
  }

  /**
   * @param {string} key
   * @param {*} value
   * @param {function} cb
   * @returns {Storage}
   */
  set (key, value, cb) {
    this.data[key] = value
    cb()
    this.save()
    return this
  }

  /**
   * @param {string} key
   * @param {function} cb
   * @returns {Storage}
   */
  del (key, cb) {
    delete this.data[key]
    cb()
    this.save()
    return this
  }

  /**
   * @private
   * @returns {Storage}
   */
  save () {
    if (this.saving) {
      this.saveQueued = true
      return this
    }

    this.saving = true
    setImmediate(() => fsExtra.writeJson(this.path, this.data, this.saveCb))
    return this
  }

  /**
   * @private
   * @param err
   * @returns {Storage}
   */
  saveCb (err) {
    if (err) this.log.error(err)
    this.saving = false
    if (this.saveQueued) {
      this.saveQueued = false
      this.save()
    }
    return this
  }
}

module.exports = Storage
