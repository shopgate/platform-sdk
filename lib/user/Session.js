class Session {
  constructor (data) {
    this.token = data ? data.token : null
  }

  /**
   * @returns {boolean}
   */
  hasToken () {
    return !!this.token
  }

  setToken (token) {
    this.token = token
    return this
  }
}

module.exports = Session
