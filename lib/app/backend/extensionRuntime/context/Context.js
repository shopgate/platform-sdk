const request = require('request')
const uuid = require('uuid/v4')

function storageInterface (storage, path) {
  return {
    get: (key, cb) => storage.get(path + key, cb),
    set: (key, value, cb) => storage.set(path + key, value, cb),
    del: (key, cb) => storage.del(path + key, cb)
  }
}

function userStorageInterface (storage, appId, extensionId, userId) {
  if (userId) return storageInterface(storage, `${appId}/${extensionId}/users/${userId}/`)
  const error = new Error('user not logged in')
  return {
    get: (key, cb) => cb(error),
    set: (key, value, cb) => cb(error),
    del: (key, cb) => cb(error)
  }
}

class Context {
  /**
   * @param {Storage} storage
   * @param {object} config
   * @param {DcResponseHandler} dcResponseHandler
   * @param {string} extensionId
   * @param {object} meta
   * @param {string} meta.appId
   * @param {string} meta.deviceId
   * @param {string} [meta.userId]
   * @param {object} log
   */
  constructor (storage, config, dcResponseHandler, extensionId, meta, log) {
    this.meta = meta
    this.config = config
    this.storage = {
      extension: storageInterface(storage, `${meta.appId}/${extensionId}/storage/`),
      device: storageInterface(storage, `${meta.appId}/${extensionId}/devices/${meta.deviceId}/`),
      user: userStorageInterface(storage, meta.appId, extensionId, meta.userId)
    }

    this.settings = storageInterface(storage, `${meta.appId}/${extensionId}/settings/`)
    delete this.settings.set
    delete this.settings.del

    this.app = {
      getInfo: (cb) => {
        const requestId = uuid()
        dcResponseHandler.add(requestId, cb)
        process.send({
          type: 'dcRequest',
          dcRequest: {resource: 'appinfos', requestId, appId: meta.appId, deviceId: meta.deviceId}
        })
      }
    }
    this.device = {
      getInfo: (cb) => {
        const requestId = uuid()
        dcResponseHandler.add(requestId, cb)
        process.send({
          type: 'dcRequest',
          dcRequest: {resource: 'deviceinfos', requestId, appId: meta.appId, deviceId: meta.deviceId}
        })
      }
    }

    this.tracedRequest = () => request
    this.log = log
  }
}

module.exports = Context
