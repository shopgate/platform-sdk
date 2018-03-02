class DcResponseHandler {
  constructor () {
    this._requests = []
  }

  /**
   * @param {string} requestId
   * @param {Function} cb
   */
  add (requestId, cb) {
    this._requests.push({requestId, cb})
  }

  /**
   * @param {string} requestId
   * @returns {Function}
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

    DcResponseHandler.getInstance().pull(message.requestId)(message.info)
  }
}

module.exports = DcResponseHandler
