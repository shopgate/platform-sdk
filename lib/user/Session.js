class Session {
  constructor (token) {
    this.token = token
  }

  /**
   * @returns {boolean}
   */
  hasToken () {
    return !!this.token
  }
}

module.exports = Session
