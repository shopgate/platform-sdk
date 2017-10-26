class FrontendSettings {
  /**
   * @param {Object} settings The frontend settings
   */
  constructor (settings = {}) {
    this.settings = settings
  }

  /**
   * @return {string}
   */
  getIpAddress () {
    return this.settings.ip
  }

  /**
   * @return {Number}
   */
  getPort () {
    return this.settins.port
  }

  /**
   * @return {Number}
   */
  getHmrPort () {
    return this.settings.hmrPort
  }

  /**
   * @return {Number}
   */
  getRemotePort () {
    return this.settings.remotePort
  }

  /**
   * @return {string}
   */
  getAccessToken () {
    return this.settings.accessToken
  }

  /**
   * @return {string}
   */
  getSourceMapsType () {
    return this.settings.sourceMapsType
  }

  /**
   * @param {string} ip The local IP address
   * @return {FrontendSettings}
   */
  setIpAdress (ip) {
    this.settings.ip = ip
    return this
  }

  /**
   * @param {Number} port The Rapid Dev Server port.
   * @return {FrontendSettings}
   */
  setPort (port) {
    this.settings.port = port
    return this
  }

  /**
   * @param {Number} hmrPort The Hot Module Replacement port.
   * @return {FrontendSettings}
   */
  setHmrPort (hmrPort) {
    this.settings.hmrPort = hmrPort
    return this
  }

  /**
   * @param {Number} remotePort The Remote Dev Tools port.
   * @return {FrontendSettings}
   */
  setRemotePort (remotePort) {
    this.settings.remotePort = remotePort
    return this
  }

  /**
   * @param {string} accessToken The jenkins access token.
   * @return {FrontendSettings}
   */
  setAccessToken (accessToken) {
    this.settings.accessToken = accessToken
    return this
  }

  /**
   * @param {string} sourceMapsType The source maps type.
   * @return {FrontendSettings}
   */
  setSourceMapsType (sourceMapsType) {
    this.settings.sourceMapsType = sourceMapsType
    return this
  }

  /**
   * @return {Object}
   */
  toJSON () {
    return this.settings
  }
}

module.exports = FrontendSettings
