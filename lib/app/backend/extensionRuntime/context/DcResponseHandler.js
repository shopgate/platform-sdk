const uuid = require('uuid/v4')

class DcResponseHandler {
  constructor () {
    this._requests = []
  }

  /**
   * @param {string} appId
   * @param {string} deviceId
   * @param {Function} cb
   */
  requestAppInfo (appId, deviceId, cb) {
    this.request('appinfos', appId, deviceId, cb)
  }

  /**
   * @param {string} appId
   * @param {string} deviceId
   * @param {Function} cb
   */
  requestDeviceInfo (appId, deviceId, cb) {
    this.request('deviceinfos', appId, deviceId, cb)
  }

  /**
   * @param {string} resourceName
   * @param {string} appId
   * @param {string} deviceId
   * @param {Function} cb
   */
  request (resourceName, appId, deviceId, cb) {
    const requestId = uuid()

    this._requests.push({ requestId, cb })
    process.send({
      type: 'dcRequest',
      dcRequest: { resourceName, requestId, appId, deviceId }
    })
  }

  /**
   * @param {string} requestId
   * @returns {Function} The callback function mapped to the request ID.
   */
  pull (requestId) {
    return this._requests.find(request => request.requestId === requestId).cb
  }

  /**
   * @returns {DcResponseHandler}
   */
  static getInstance () {
    if (!DcResponseHandler.instance) DcResponseHandler.instance = new DcResponseHandler()

    return DcResponseHandler.instance
  }

  /**
   * @param {Object} message
   * @param {string} message.type
   * @param {string} message.requestId
   * @param {Object} message.info
   */
  static handle (message) {
    if (message.type !== 'dcResponse') return

    DcResponseHandler.getInstance().pull(message.requestId)(null, message.info)
  }
}

module.exports = DcResponseHandler
