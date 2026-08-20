const uuid = require('node:crypto').randomUUID
const t = require('../../../../i18n')(__filename)
// @ts-check
class DcRequester {
  /**
   *
   * @param {Function} uuid A function that returns a UUID string.
   */
  constructor (uuid) {
    this._uuid = uuid
    this._requests = []
  }

  /**
   * @param {string} appId
   * @param {string} deviceId
   * @param {Function} [cb]
   * @returns {Promise<any>|void}
   */
  requestAppInfo (appId, deviceId, cb) {
    return this.request('appinfos', appId, deviceId, cb)
  }

  /**
   * @param {string} appId
   * @param {string} deviceId
   * @param {Function} [cb]
   * @returns {Promise<any>|void}
   */
  requestDeviceInfo (appId, deviceId, cb) {
    return this.request('deviceinfos', appId, deviceId, cb)
  }

  /**
   * Logs a user in (truthy userId) or out (falsy userId) on the in-flight pipeline request.
   * @param {string} appId
   * @param {string} pipelineRequestId requestId of the in-flight pipeline request (meta.requestId)
   * @param {string|null} userId
   * @param {Function} [cb]
   * @returns {Promise<any>|void}
   */
  requestUserAuth (appId, pipelineRequestId, userId, cb) {
    if (!cb) {
      return new Promise((resolve, reject) => {
        this.requestUserAuth(appId, pipelineRequestId, userId, (err, data) => {
          if (err) return reject(err)
          return resolve(data)
        })
      })
    }
    const requestId = this._uuid()

    this._requests.push({ requestId, cb })
    process.send({
      type: 'dcRequest',
      // requestId correlates this IPC round-trip; pipelineRequestId identifies the pipeline request on the plc
      dcRequest: { resourceName: 'userAuth', requestId, appId, pipelineRequestId, userId }
    })
  }

  /**
   * @param {string} resourceName
   * @param {string} appId
   * @param {string} deviceId
   * @param {Function} [cb]
   * @returns {Promise<any>|void}
   */
  request (resourceName, appId, deviceId, cb) {
    if (!cb) {
      return new Promise((resolve, reject) => {
        this.request(resourceName, appId, deviceId, (err, data) => {
          if (err) return reject(err)
          return resolve(data)
        })
      })
    }
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
   * @throws {Error} If the request ID / cb function could not be found.
   */
  pull (requestId) {
    const index = this._requests.findIndex(request => request.requestId === requestId)

    if (index === -1 || !this._requests[index].cb) {
      throw new Error(t('ERROR_NO_CALLBACK_FOR_REQUEST', { requestId }))
    }

    return this._requests.splice(index, 1)[0].cb
  }

  /**
   * @returns {DcRequester}
   */
  static getInstance () {
    if (!DcRequester.instance) DcRequester.instance = new DcRequester(uuid)

    return DcRequester.instance
  }

  /**
   * @param {Object} message
   * @param {string} message.type
   * @param {string} message.requestId
   * @param {Object} [message.info]
   * @param {Object} [message.error]
   * @throws {Error} If no callback function was found for the incoming message.
   * @throws {Error} Any Error bubbling up from the callback function.
   */
  static handleResponse (message) {
    if (message.type !== 'dcResponse') return

    let cb
    try {
      cb = DcRequester.getInstance().pull(message.requestId)
    } catch (err) {
      throw new Error(t('ERROR_NO_CALLBACK_FOR_DC_RESPONSE', { message: JSON.stringify(message) }))
    }

    let error = null
    if (message.error) {
      error = new Error(message.error.message)
      if (message.error.code) error.code = message.error.code
    }

    // call outside try/catch so it doesn't accidentally swallow errors thrown from the callback
    cb(error, message.info)
  }
}

/** @type {DcRequester} */
DcRequester.instance = null
module.exports = DcRequester
