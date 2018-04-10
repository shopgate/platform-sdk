const request = require('request')
// @ts-check
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

  const errorCb = (cb) => {
    if (cb) return cb(error)
    throw error
  }

  return {
    get: (key, cb) => errorCb(cb),
    set: (key, value, cb) => errorCb(cb),
    del: (key, cb) => errorCb(cb)
  }
}

function mapStorageInterface (mapStorage, path) {
  return {
    get: (mapId, cb) => mapStorage.get(`${path}${mapId}`, cb),
    set: (mapId, newMap, cb) => mapStorage.set(`${path}${mapId}`, newMap, cb),
    del: (mapId, cb) => mapStorage.del(`${path}${mapId}`, cb),
    getItem: (mapId, key, cb) => mapStorage.getItem(`${path}${mapId}`, key, cb),
    setItem: (mapId, key, value, cb) => mapStorage.setItem(`${path}${mapId}`, key, value, cb),
    delItem: (mapId, key, cb) => mapStorage.delItem(`${path}${mapId}`, key, cb)
  }
}

function userMapStorageInterface (mapStorage, appId, extensionId, userId) {
  if (userId) return storageInterface(mapStorage, `${appId}/${extensionId}/users/${userId}/`)
  const error = new Error('user not logged in')

  const errorCb = (cb) => {
    if (cb) return cb(error)
    throw error
  }

  return {
    get: (mapId, cb) => errorCb(cb),
    set: (mapId, newMap, cb) => errorCb(cb),
    del: (mapId, cb) => errorCb(cb),
    getItem: (mapId, key, cb) => errorCb(cb),
    setItem: (mapId, key, value, cb) => errorCb(cb),
    delItem: (mapId, key, cb) => errorCb(cb)
  }
}

class Context {
  /**
   * @param {Storage} storage
   * @param {MapStorage} mapStorage
   * @param {object} config
   * @param {DcRequester} dcRequester
   * @param {string} extensionId
   * @param {object} meta
   * @param {string} meta.appId
   * @param {string} meta.deviceId
   * @param {string} [meta.userId]
   * @param {object} log
   */
  constructor (storage, mapStorage, config, dcRequester, extensionId, meta, log) {
    this.meta = meta
    this.config = config
    this.storage = {
      extension: storageInterface(storage, `${meta.appId}/${extensionId}/storage/`),
      device: storageInterface(storage, `${meta.appId}/${extensionId}/devices/${meta.deviceId}/`),
      user: userStorageInterface(storage, meta.appId, extensionId, meta.userId),
      map: {
        extension: mapStorageInterface(mapStorage, `${meta.appId}/${extensionId}/storage/`),
        device: mapStorageInterface(mapStorage, `${meta.appId}/${extensionId}/storage/${meta.deviceId}/`),
        user: userMapStorageInterface(mapStorage, meta.appId, extensionId, meta.userId)
      }
    }

    this.settings = storageInterface(storage, `${meta.appId}/${extensionId}/settings/`)
    delete this.settings.set
    delete this.settings.del

    this.app = {
      getInfo: (cb) => {
        dcRequester.requestAppInfo(meta.appId, meta.deviceId, cb)
      }
    }
    this.device = {
      getInfo: (cb) => {
        dcRequester.requestDeviceInfo(meta.appId, meta.deviceId, cb)
      }
    }

    this.tracedRequest = () => request
    this.log = log
  }
}

module.exports = Context
