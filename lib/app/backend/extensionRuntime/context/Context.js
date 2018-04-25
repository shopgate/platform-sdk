const request = require('request')

// @ts-check
function storageInterface (storage, mapStorage, path, mapPath) {
  const storageInterface = {
    get: (key, cb) => storage.get(path + key, cb),
    set: (key, value, cb) => storage.set(path + key, value, cb),
    del: (key, cb) => storage.del(path + key, cb)
  }

  if (mapStorage) {
    storageInterface.map = mapStorageInterface(mapStorage, mapPath)
  }

  return storageInterface
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

function userStorageInterface (storage, mapStorage, appId, extensionId, userId) {
  if (userId) return storageInterface(storage, mapStorage, `${appId}/${extensionId}/users/${userId}/`, `${appId}/${extensionId}/users/mapStorage/${userId}/`)
  const error = new Error('user not logged in')

  const errorCb = (cb) => {
    if (cb) return cb(error)
    throw error
  }

  return {
    get: (key, cb) => errorCb(cb),
    set: (key, value, cb) => errorCb(cb),
    del: (key, cb) => errorCb(cb),
    map: {
      get: (mapId, cb) => errorCb(cb),
      set: (mapId, newMap, cb) => errorCb(cb),
      del: (mapId, cb) => errorCb(cb),
      getItem: (mapId, key, cb) => errorCb(cb),
      setItem: (mapId, key, value, cb) => errorCb(cb),
      delItem: (mapId, key, cb) => errorCb(cb)
    }
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
      extension: storageInterface(storage, mapStorage, `${meta.appId}/${extensionId}/storage/`, `${meta.appId}/${extensionId}/mapStorage/`),
      device: storageInterface(storage, mapStorage, `${meta.appId}/${extensionId}/devices/${meta.deviceId}/`, `${meta.appId}/${extensionId}/mapStorage/${meta.deviceId}/`),
      user: userStorageInterface(storage, mapStorage, meta.appId, extensionId, meta.userId)
    }

    this.settings = storageInterface(storage, null, `${meta.appId}/${extensionId}/settings/`)
    delete this.settings.set
    delete this.settings.del

    this.app = {
      getInfo: (cb) => (dcRequester.requestAppInfo(meta.appId, meta.deviceId, cb))
    }
    this.device = {
      getInfo: (cb) => (dcRequester.requestDeviceInfo(meta.appId, meta.deviceId, cb))
    }

    this.tracedRequest = () => request
    this.log = log
  }
}

module.exports = Context
