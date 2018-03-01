const fsEx = require('fs-extra')
const path = require('path')
const async = require('async')

class Storage {
  /**
   * @param {AppSettings} appSettings
   * @param {Logger} log
   */
  constructor (appSettings, log) {
    this.path = process.env.STORAGE_PATH || path.join(appSettings.settingsFolder, 'storage.json')
    this.log = log
    this._queue = async.queue(async task => this._handleStorageOperation(task))
  }

  /**
   * @param {string} key
   * @param {function} cb
   */
  get (key, cb) {
    this._queue.push({operation: 'get', key, cb})
  }

  /**
   * @param {string} key
   * @param {*} value
   * @param {function} cb
   */
  set (key, value, cb) {
    this._queue.push({operation: 'set', key, value, cb})
  }

  /**
   * @param {string} key
   * @param {function} cb
   */
  del (key, cb) {
    this._queue.push({operation: 'del', key, cb})
  }

  async _loadStorage () {
    try {
      return await fsEx.readJSON(this.path)
    } catch (err) {
      if (process.env['LOG_LEVEL'] === 'debug') this.log.debug(`Can't read storage file: ${err}`)
      return {}
    }
  }

  /**
   * @param {Object} task
   * @param {String} task.operation
   * @param {String} task.key
   * @param {*} task.value
   * @param {Function} task.cb
   * @private
   */
  async _handleStorageOperation (task) {
    const storage = await this._loadStorage()

    switch (task.operation) {
      case 'get':
        task.cb(null, storage[task.key])
        break

      case 'set':
        try {
          storage[task.key] = task.value
          await fsEx.writeJSON(this.path, storage, {spaces: 2})
          task.cb()
        } catch (err) {
          task.cb(err)
        }
        break

      case 'del':
        try {
          delete storage[task.key]
          await fsEx.writeJSON(this.path, storage, {spaces: 2})
          task.cb()
        } catch (err) {
          task.cb(err)
        }
        break

      default:
        throw new Error(`Unrecognized storage operation: ${task.operation}`)
    }
  }
}

module.exports = Storage
