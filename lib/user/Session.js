class Session {
  /**
   * @returns {boolean}
   */
  hasToken () {
    return !!this.token
  }
}

module.exports = Session
