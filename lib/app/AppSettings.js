/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const path = require('path')
const FrontendSettings = require('./frontend/FrontendSettings')
const logger = require('../logger')
const fsEx = require('fs-extra')

const SETTINGS_FOLDER = '.sgcloud'
const EXTENSIONS_FOLDER = 'extensions'
const PIPELINES_FOLDER = 'pipelines'
const THEMES_FOLDER = 'themes'

let instance

class AppSettings {
  /**
   * @returns {AppSettings}
   */
  static getInstance () {
    if (!instance) instance = new AppSettings().init()
    return instance
  }

  static setInstance (appSettings) {
    instance = appSettings
  }

  constructor () {
    this.settingsFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, SETTINGS_FOLDER) : SETTINGS_FOLDER
    this.settingsFile = path.join(this.settingsFolder, 'app.json')
    this.attachedExtensionsFile = path.join(this.settingsFolder, 'attachedExtensions.json')
    this.frontendSettings = new FrontendSettings(path.join(this.settingsFolder))
  }

  /**
   * @returns {string}
   */
  getId () {
    const data = this._loadSettings()
    if (!data.id) throw new Error('application data invalid')
    return data.id
  }

  /**
   * @param {string} id
   * @returns {AppSettings}
   */
  setId (id) {
    const data = this._loadSettings()
    data.id = id
    return this._saveSettings(data)
  }

  _saveExtensions (extensions) {
    fsEx.ensureDirSync(this.settingsFolder)
    fsEx.writeJsonSync(this.attachedExtensionsFile, {attachedExtensions: extensions})
    return this
  }

  /**
   * Attaches a extension
   * @param {string} pathName
   * @param {string} extensionId
   * @param {Boolean} [force=false]
   * @returns {AppSettings}
   */
  attachExtension (pathName, extensionId, force) {
    const extensions = this._loadExtensions()
    if (!force && extensions[extensionId]) throw new Error(`Extension '${extensionId} (${pathName}) is already attached`)

    extensions[extensionId] = {path: pathName}
    this._saveExtensions(extensions)
    logger.info(`Attached ${extensionId} (${pathName})`)
    return this
  }

  /**
   * Detaches a extension
   * @param extensionId
   * @return {AppSettings}
   */
  detachExtension (extensionId) {
    const extensions = this._loadExtensions()
    if (!extensions[extensionId]) {
      logger.warn(`The extension '${extensionId}' is not attached`)
      return this
    }

    delete extensions[extensionId]
    this._saveExtensions(extensions)
    logger.info(`Detached ${extensionId}`)
    return this
  }

  _loadExtensions () {
    try {
      return fsEx.readJsonSync(this.attachedExtensionsFile)
    } catch (err) {
      throw new Error('application not initialized')
    }
  }

  /**
   * Detaches all extensions
   */
  detachAllExtensions () {
    this._saveExtensions({})
    logger.info('Detached all extensions')
    return this
  }

  /**
   * @returns {AppSettings}
   */
  _loadSettings () {
    try {
      return fsEx.readJsonSync(this.settingsFile)
    } catch (err) {
      logger.debug(err)
      throw new Error('application not initialized')
    }
  }

  _saveSettings (settings) {
    fsEx.ensureDirSync(this.settingsFolder)
    fsEx.writeJsonSync(this.settingsFile, settings, {spaces: 2})
    return this
  }

  /**
   * @returns {FrontendSettings}
   */
  getFrontendSettings () {
    return this.frontendSettings
  }
}

module.exports = AppSettings
module.exports.SETTINGS_FOLDER = SETTINGS_FOLDER
module.exports.PIPELINES_FOLDER = PIPELINES_FOLDER
module.exports.EXTENSIONS_FOLDER = EXTENSIONS_FOLDER
module.exports.THEMES_FOLDER = THEMES_FOLDER
