const uuid = require('uuid/v4')

class DcRequester {
  /**
   *
   * @param {uuid/v1|uuid/v4|Function} uuid A function that returns a UUID string.
   */
  constructor (uuid) {
    this._uuid = uuid
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
    const requestId = this._uuid()

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
   * @returns {DcRequester}
   */
  static getInstance () {
    if (!DcRequester.instance) DcRequester.instance = new DcRequester()

    return DcRequester.instance
  }

  /**
   * @param {Object} message
   * @param {string} message.type
   * @param {string} message.requestId
   * @param {Object} message.info
   */
  static handleResponse (message) {
    if (message.type !== 'dcResponse') return

    DcRequester.getInstance().pull(message.requestId)(null, message.info)
  }
}

module.exports = DcRequester
