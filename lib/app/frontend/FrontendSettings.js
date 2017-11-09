/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const THEMES_FOLDER = 'themes'
const PWA_FOLDER = 'pwa'

class FrontendSettings {
  /**
   * @param {Object} settings The frontend settings
   */
  constructor (settings = {}) {
    this.settings = settings
  }

  /**
   * Returns the IP address from the settings.
   * @return {string}
   */
  getIpAddress () {
    return this.settings.ip
  }

  /**
   * Returns the port from the settings.
   * @return {Number}
   */
  getPort () {
    return this.settings.port
  }

  /**
   * Returns the API port from the settings.
   * @return {Number}
   */
  getApiPort () {
    return this.settings.apiPort
  }

  /**
   * Returns the HMR port from the settings.
   * @return {Number}
   */
  getHmrPort () {
    return this.settings.hmrPort
  }

  /**
   * Returns the Remote Dev Tools port from the settings.
   * @return {Number}
   */
  getRemotePort () {
    return this.settings.remotePort
  }

  /**
   * Returns the access token from the settings.
   * @return {string}
   */
  getAccessToken () {
    return this.settings.accessToken
  }

  /**
   * Returns the source map type for the settings.
   * @return {string}
   */
  getSourceMapsType () {
    return this.settings.sourceMapsType
  }

  /**
   * Sets the IP address.
   * @param {string} ip The local IP address
   * @return {FrontendSettings}
   */
  setIpAddress (ip) {
    this.settings.ip = ip
    return this
  }

  /**
   * Sets the server port.
   * @param {Number} port The Rapid Dev Server port.
   * @return {FrontendSettings}
   */
  setPort (port) {
    this.settings.port = port
    return this
  }

  /**
   * Sets the API server port.
   * @param {Number} apiPort The Rapid Dev Server port.
   * @return {FrontendSettings}
   */
  setApiPort (apiPort) {
    this.settings.apiPort = apiPort
    return this
  }

  /**
   * Sets the HMR port.
   * @param {Number} hmrPort The Hot Module Replacement port.
   * @return {FrontendSettings}
   */
  setHmrPort (hmrPort) {
    this.settings.hmrPort = hmrPort
    return this
  }

  /**
   * Sets the Remote Dev Tools port.
   * @param {Number} remotePort The Remote Dev Tools port.
   * @return {FrontendSettings}
   */
  setRemotePort (remotePort) {
    this.settings.remotePort = remotePort
    return this
  }

  /**
   * Sets the access token.
   * @param {string} accessToken The jenkins access token.
   * @return {FrontendSettings}
   */
  setAccessToken (accessToken) {
    this.settings.accessToken = accessToken
    return this
  }

  /**
   * Sets the source map type.
   * @param {string} sourceMapsType The source maps type.
   * @return {FrontendSettings}
   */
  setSourceMapsType (sourceMapsType) {
    this.settings.sourceMapsType = sourceMapsType
    return this
  }

  /**
   * Returns the settings.
   * @return {Object}
   */
  toJSON () {
    return this.settings
  }
}

module.exports = FrontendSettings
module.exports.THEMES_FOLDER = THEMES_FOLDER
module.exports.PWA_FOLDER = PWA_FOLDER
