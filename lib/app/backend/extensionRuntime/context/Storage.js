const fsEx = require('fs-extra')
const async = require('async')
const t = require('../../../../i18n')(__filename)

// @ts-check
class Storage {
  /**
   * @param {string} storageFilePath
   * @param {Logger} log
   */
  constructor (storageFilePath, log) {
    this.path = storageFilePath
    this.log = log
    this._queue = async.queue(async task => this._handleStorageOperation(task))
  }

  /**
   * @param {string} key
   * @param {function} [cb]
   * @returns {Promise<any>|void} if cb given, cb will be executed, otherwise this function returns a promise
   */
  get (key, cb) {
    if (!cb) {
      return new Promise((resolve, reject) => {
        this.get(key, (err, value) => {
          if (err) return reject(err)
          return resolve(value)
        })
      })
    }

    this._queue.push({ operation: 'get', key, cb }, err => { if (err) throw err })
  }

  /**
   * @param {string} key
   * @param {*} value
   * @param {function} [cb]
   * @returns {Promise<any>|void} if cb given, cb will be executed, otherwise this function returns a promise
   */
  set (key, value, cb) {
    if (!cb) {
      return new Promise((resolve, reject) => {
        this.set(key, value, (err, value) => {
          if (err) return reject(err)
          return resolve(value)
        })
      })
    }

    this._queue.push({ operation: 'set', key, value, cb }, err => { if (err) throw err })
  }

  /**
   * @param {string} key
   * @param {function} [cb]
   * @returns {Promise<void>|void} if cb given, cb will be executed, otherwise this function returns a promise
   */
  del (key, cb) {
    if (!cb) {
      return new Promise((resolve, reject) => {
        this.del(key, (err, value) => {
          if (err) return reject(err)
          return resolve(value)
        })
      })
    }

    this._queue.push({ operation: 'del', key, cb }, err => { if (err) throw err })
  }

  /**
   * @returns {Promise<Object>}
   * @private
   */
  async _loadStorage () {
    try {
      return await fsEx.readJSON(this.path)
    } catch (err) {
      if (process.env['LOG_LEVEL'] === 'debug') this.log.debug(t('ERROR_CANNOT_READ_STORAGE_FILE', { err }))
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
          if (typeof task.value === 'undefined') {
            return task.cb(new Error(t('ERROR_CANNOT_SAVE_UNDEFINED')))
          }

          storage[task.key] = task.value
          await fsEx.writeJSON(this.path, storage, { spaces: 2 })
          task.cb()
        } catch (err) {
          task.cb(err)
        }
        break

      case 'del':
        try {
          delete storage[task.key]
          await fsEx.writeJSON(this.path, storage, { spaces: 2 })
          task.cb()
        } catch (err) {
          task.cb(err)
        }
        break
    }
  }
}

module.exports = Storage
