/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const path = require('path')
const FrontendSettings = require('./frontend/FrontendSettings')
const logger = require('../logger')

const SETTINGS_FOLDER = '.sgcloud'
const EXTENSIONS_FOLDER = 'extensions'
const PIPELINES_FOLDER = 'pipelines'
const THEMES_FOLDER = 'themes'
const SETTINGS_APP_FILE = 'app.json'
const SETTINGS_FRONTEND_FILE = 'frontend.json'
const EXTENSIONS_FILE = 'attachedExtensions.json'
const fsEx = require('fs-extra')

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
    this.settingsFile = path.join(this.settingsFolder, SETTINGS_APP_FILE)
    this.frontendSettingsFile = path.join(this.settingsFolder, SETTINGS_FRONTEND_FILE)
    this.attachedExtensionsFile = path.join(this.settingsFolder, EXTENSIONS_FILE)
    this.attachedExtensions = {}
  }

  /**
   * @returns {string}
   */
  getId () {
    return this.id
  }

  /**
   * @param {string} id
   * @returns {AppSettings}
   */
  setId (id) {
    this.id = id
    return this
  }

  setAttachedExtensions (extensions) {
    this.attachedExtensions = extensions
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
    if (!force && this.attachedExtensions[extensionId]) {
      throw new Error(`Extension '${extensionId} (${pathName}) is already attached`)
    }

    logger.info(`Attached ${extensionId} (${pathName})`)
    this.attachedExtensions[extensionId] = {path: pathName}
    return this
  }

  /**
   * Detaches a extension
   * @param extensionId
   * @return {AppSettings}
   */
  detachExtension (extensionId) {
    if (!this.attachedExtensions[extensionId]) {
      logger.warn(`The extension '${extensionId}' is not attached`)
      return this
    }

    logger.info(`Detached ${extensionId}`)
    delete this.attachedExtensions[extensionId]
    return this
  }

  /**
   * Detaches all extensions
   */
  detachAllExtensions () {
    logger.info('Detached all extensions')
    this.attachedExtensions = {}
    return this
  }

  /**
   * @returns {AppSettings}
   */
  init () {
    if (!fsEx.pathExists(this.settingsFile) || !fsEx.pathExists(this.attachedExtensionsFile)) {
      throw new Error('application not initialized')
    }

    const data = fsEx.readJsonSync(this.settingsFile, {throws: false}) || {}
    this.setId(data.id)
    const extensions = fsEx.readJsonSync(this.attachedExtensionsFile, {throws: false}) || {}
    this.setAttachedExtensions(extensions.attachedExtensions)

    if (!this.id || !this.attachedExtensions) throw new Error('application data invalid')

    return this
  }

  /**
   * @returns {AppSettings}
   */
  save () {
    fsEx.emptyDirSync(this.settingsFolder)
    fsEx.writeJsonSync(this.settingsFile, this, {spaces: 2})
    fsEx.writeJsonSync(this.frontendSettingsFile, this.getFrontendSettings(), {spaces: 2})
    fsEx.writeJsonSync(this.attachedExtensionsFile, {attachedExtensions: this.attachedExtensions})

    return this
  }

  /**
   * @returns {object}
   */
  toJSON () {
    return {
      id: this.id
    }
  }

  /**
   * @returns {FrontendSettings}
   */
  getFrontendSettings () {
    if (!this.frontendSettings) {
      if (fsEx.existsSync(this.frontendSettingsFile)) {
        this.frontendSettings = new FrontendSettings(JSON.parse(fsEx.readFileSync(this.frontendSettingsFile)))
      } else {
        this.frontendSettings = new FrontendSettings()
      }
    } else {
      this.frontendSettings = new FrontendSettings(this.frontendSettings.settings)
    }

    return this.frontendSettings
  }
}

module.exports = AppSettings
module.exports.SETTINGS_FOLDER = SETTINGS_FOLDER
module.exports.PIPELINES_FOLDER = PIPELINES_FOLDER
module.exports.EXTENSIONS_FOLDER = EXTENSIONS_FOLDER
module.exports.THEMES_FOLDER = THEMES_FOLDER
module.exports.EXTENSIONS_FILE = EXTENSIONS_FILE
