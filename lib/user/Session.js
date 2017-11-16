class Session {
  /**
   * @param {Object} [data]
   * @param {String} [data.token] - JWT Session Token
   */
  constructor (data) {
    this.token = data ? data.token : null
  }

  /**
   * @returns {String}
   */
  getToken () {
    return this.token
  }

  /**
   * @param {String} token - JWT Session Token
   * @return {Session}
   */
  setToken (token) {
    this.token = token
    return this
  }
}

module.exports = Session
