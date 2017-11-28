const request = require('request')

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
   * @param {DcHttpClient} dcHttpClient
   * @param {object} config
   * @param {string} extensionId
   * @param {object} meta
   * @param {string} meta.appId
   * @param {string} meta.deviceId
   * @param {string} [meta.userId]
   * @param {object} log
   */
  constructor (storage, dcHttpClient, config, extensionId, meta, log) {
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
      getInfo: (cb) => dcHttpClient.getInfos('appinfos', meta.appId, meta.deviceId, cb)
    }
    this.device = {
      getInfo: (cb) => dcHttpClient.getInfos('deviceinfos', meta.appId, meta.deviceId, cb)
    }

    this.tracedRequest = () => request
    this.log = log
  }
}

module.exports = Context
