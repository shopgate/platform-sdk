const Storage = require('./Storage')

function getStorage (type, extensionId, readOnly) {
  const storage = Storage.getInstance()
  const storageInterface = {get: (key, cb) => storage.get(type, extensionId, key, cb)}

  if (!readOnly) {
    storageInterface.set = (key, value, cb) => storage.set(type, extensionId, key, value, cb)
    storageInterface.del = (key, cb) => storage.del(type, extensionId, key, cb)
  }

  return storageInterface
}

class Context {
  constructor (extensionId) {
    this.meta = {}
    this.config = {}
    this.storage = {
      device: getStorage('device', extensionId),
      extension: getStorage('extension', extensionId),
      user: getStorage('user', extensionId)
    }

    this.settings = getStorage('settings', extensionId, true)

    this.app = {
      getInfo: {} // information about the users app like deviceId, applicationId, etc
    }
    this.device = {
      getInfo: {} // device info like clientType, deviceType, etc
    }
  }

  tracedRequest () {

  }

  log () {

  }
}

module.exports = Context
