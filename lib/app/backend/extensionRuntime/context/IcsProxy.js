// todo: use DCHttpClient
class IntercomponentStorage {
  /**
   * @param {object} socket
   * @param {string} appId
   */
  constructor (socket, appId) {
    this.socket = socket
    this.appId = appId
  }

  /**
   * @param {string} deviceId
   * @param {function} cb
   */
  getAppInfo (deviceId, cb) {
    this.getInformation('getAppInfos', {deviceId, applicationId: this.appId}, cb)
  }

  /**
   * @param {string} deviceId
   * @param {function} cb
   */
  getDeviceInfo (deviceId, cb) {
    this.getInformation('getDeviceInfos', {deviceId}, cb)
  }

  /**
   * @param {string} path
   * @param {object} data
   * @param {function} cb
   * @private
   */
  getInformation (path, data, cb) {
    this.socket.emit(path, data, cb)
  }
}

module.exports = IntercomponentStorage
