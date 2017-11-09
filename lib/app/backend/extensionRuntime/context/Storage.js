const fsExtra = require('fs-extra')
const AppSettings = require('../../../AppSettings')
const path = require('path')

let instance

class Storage {
  static getInstance () {
    if (!instance) instance = new Storage()
    return instance
  }

  constructor () {
    this.path = process.env.STORAGE_PATH || path.join(AppSettings.SETTINGS_FOLDER, 'storage.json')
    this.data = fsExtra.readJsonSync(this.path, {throws: false}) || {}
  }

  get (type, extensionId, key, cb) {
    if (!this.data[type] || !this.data[type][extensionId]) return cb()
    cb(null, this.data[type][extensionId][key])
  }

  set (type, extensionId, key, value, cb) {
    if (!this.data[type]) this.data[type] = {}
    if (!this.data[type][extensionId]) this.data[type][extensionId] = {}
    this.data[type][extensionId][key] = value
    cb()
    this.save()
  }

  del (type, extensionId, key, cb) {
    if (this.data[type]) {
      if (this.data[type][extensionId]) {
        delete this.data[type][extensionId][key]
        if (!Object.keys(this.data[type][extensionId]).length) delete this.data[type][extensionId]
      }
      if (!Object.keys(this.data[type]).length) delete this.data[type]
    }
    cb()
    this.save()
  }

  save () {
    if (this.saving) {
      if (this.saveQueued) return
      this.saveQueued = true
      return setImmediate(this.save.bind(this))
    }
    this.saveQueued = false
    this.saving = true
    fsExtra.writeJson(this.path, this.data, err => {
      if (err) console.log(err)
      this.saving = false
    })
  }
}

module.exports = Storage
