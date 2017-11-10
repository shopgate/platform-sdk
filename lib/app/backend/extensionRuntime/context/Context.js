const Storage = require('./Storage')

function storageInterface (path) {
  const storage = Storage.getInstance()
  return {
    get: (key, cb) => storage.get(path + key, cb),
    set: (key, value, cb) => storage.set(path + key, value, cb),
    del: (key, cb) => storage.del(path + key, cb)
  }
}

function userStorage (extensionId, userId) {
  if (userId) return storageInterface(`${extensionId}/users/${userId}/`)
  const error = new Error('user not logged in')
  return {get: (key, cb) => cb(error), set: (key, value, cb) => cb(error), del: (key, cb) => cb(error)}
}

class Context {
  constructor (extensionId, deviceId, userId) {
    this.meta = {}
    this.config = {}
    this.storage = {
      extension: storageInterface(`${extensionId}/storage/`)(),
      device: storageInterface(`${extensionId}/devices/${deviceId}/`)(),
      user: userStorage(extensionId, userId)()
    }

    this.settings = storageInterface(`${extensionId}/settings/`)()
    delete this.settings.set
    delete this.settings.del

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
