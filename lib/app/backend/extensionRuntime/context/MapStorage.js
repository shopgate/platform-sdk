const fsEx = require('fs-extra')
const async = require('async')

// @ts-check
class MapStorage {
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
   * @param {string} mapId
   * @param {function} [cb]
   * @returns {Promise<any>|void} if cb given, cb will be executed, otherwise this function returns a promise
   */
  get (mapId, cb) {
    if (!cb) {
      return new Promise((resolve, reject) => {
        this.get(mapId, (err, value) => {
          if (err) return reject(err)
          return resolve(value)
        })
      })
    }

    this._queue.push({ operation: 'get', mapId, cb }, err => { if (err) throw err })
  }

  /**
   * @param {string} mapId
   * @param {object} newMap
   * @param {function} [cb]
   * @returns {Promise<any>|void} if cb given, cb will be executed, otherwise this function returns a promise
   */
  set (mapId, newMap, cb) {
    if (!cb) {
      return new Promise((resolve, reject) => {
        this.set(mapId, newMap, (err, value) => {
          if (err) return reject(err)
          return resolve(value)
        })
      })
    }

    this._queue.push({ operation: 'set', mapId, value: newMap, cb }, err => { if (err) throw err })
  }

  /**
   * @param {string} mapId
   * @param {function} [cb]
   * @returns {Promise<any>|void} if cb given, cb will be executed, otherwise this function returns a promise
   */
  del (mapId, cb) {
    if (!cb) {
      return new Promise((resolve, reject) => {
        this.del(mapId, (err, value) => {
          if (err) return reject(err)
          return resolve(value)
        })
      })
    }

    this._queue.push({ operation: 'del', mapId, cb }, err => { if (err) throw err })
  }

  /**
   * @param {string} mapId
   * @param {string} key
   * @param {function} [cb]
   * @returns {Promise<any>|void} if cb given, cb will be executed, otherwise this function returns a promise
   */
  getItem (mapId, key, cb) {
    if (!cb) {
      return new Promise((resolve, reject) => {
        this.getItem(mapId, key, (err, value) => {
          if (err) return reject(err)
          return resolve(value)
        })
      })
    }

    this._queue.push({ operation: 'getItem', mapId, key, cb }, err => { if (err) throw err })
  }

  /**
   * @param {string} mapId
   * @param {string} key
   * @param {*} value
   * @param {function} [cb]
   * @returns {Promise<any>|void} if cb given, cb will be executed, otherwise this function returns a promise
   */
  setItem (mapId, key, value, cb) {
    if (!cb) {
      return new Promise((resolve, reject) => {
        this.setItem(mapId, key, value, (err, value) => {
          if (err) return reject(err)
          return resolve(value)
        })
      })
    }

    this._queue.push({ operation: 'setItem', mapId, key, value, cb }, err => { if (err) throw err })
  }

  /**
   * @param {string} mapId
   * @param {string} key
   * @param {function} [cb]
   * @returns {Promise<void>|void} if cb given, cb will be executed, otherwise this function returns a promise
   */
  delItem (mapId, key, cb) {
    if (!cb) {
      return new Promise((resolve, reject) => {
        this.delItem(mapId, key, (err, value) => {
          if (err) return reject(err)
          return resolve(value)
        })
      })
    }

    this._queue.push({ operation: 'delItem', mapId, key, cb }, err => { if (err) throw err })
  }

  /**
   * @returns {Promise<Object>}
   * @private
   */
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
   * @param {String} task.mapId
   * @param {String} task.key
   * @param {*} task.value
   * @param {Function} task.cb
   * @private
   */
  async _handleStorageOperation (task) {
    const storage = await this._loadStorage()

    switch (task.operation) {
      case 'get':
        task.cb(null, storage[task.mapId])
        break

      case 'set':
        try {
          if (typeof task.value === 'undefined') {
            return task.cb(new Error('Cannot save undefined value'))
          }

          if (task.value !== Object(task.value) || Array.isArray(task.value)) {
            return task.cb(new Error('Cannot save non-object as a map: "' + task.value + '".'))
          }

          storage[task.mapId] = task.value
          await fsEx.writeJSON(this.path, storage, { spaces: 2 })
          task.cb()
        } catch (err) {
          task.cb(err)
        }
        break

      case 'del':
        try {
          delete storage[task.mapId]
          await fsEx.writeJSON(this.path, storage, { spaces: 2 })
          task.cb()
        } catch (err) {
          task.cb(err)
        }
        break

      case 'getItem':
        if (!storage[task.mapId]) {
          return task.cb(null, undefined)
        }

        task.cb(null, storage[task.mapId][task.key])
        break

      case 'setItem':
        try {
          if (typeof task.value === 'undefined') {
            return task.cb(new Error('Cannot save undefined value'))
          }

          // create map if not existing
          if (!storage[task.mapId]) storage[task.mapId] = {}

          storage[task.mapId][task.key] = task.value
          await fsEx.writeJson(this.path, storage, { spaces: 2 })
          task.cb()
        } catch (err) {
          task.cb(err)
        }
        break

      case 'delItem':
        if (!storage[task.mapId]) {
          return task.cb(null)
        }

        try {
          delete storage[task.mapId][task.key]
          await fsEx.writeJson(this.path, storage, { spaces: 2 })
          task.cb()
        } catch (err) {
          task.cb(err)
        }
        break
    }
  }
}

module.exports = MapStorage
