const path = require('path')
const fsEx = require('fs-extra')
const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const logger = require('../logger')

class ExtensionAction {
  /**
   * @param {Command} commander
   */
  static register (commander) {
    commander
      .command('extension <action> [extensions...]')
      .description('attaches or detaches one or more extensions')
      .action((action) => new ExtensionAction().run(action))
  }

  /**
   * @param {String} action
   * @param {String[]} [extensions]
   */
  run (action, extensions) {
    new UserSettings().validate()
    this.settings = new AppSettings().validate()

    switch (action) {
      case 'attach':
        this.attachExtensions(extensions || [])
        break
      case 'detach':
        this.detachExtensions(extensions || [])
        break
      default:
        throw new Error(`unknown action "${action}"`)
    }
  }

  /**
   * @param {String[]} extensions
   */
  attachExtensions (extensions) {
    let force = false
    if (!extensions.length) {
      extensions = this.getAllExtensions()
      force = true
    }
    extensions.forEach((extensionFolderName) => {
      const extensionInfo = this.getExtensionInfo(extensionFolderName, true)
      if (!extensionInfo) {
        return logger.warn(`There is no extension in folder: './extensions/${extensionFolderName}'. Skipping... Please make sure that you only pass the folder name of the extension as argument.`)
      }
      this.settings.attachExtension(extensionFolderName, extensionInfo, force)
    })
  }

  /**
   * @param {String[]} extensions
   */
  detachExtensions (extensions) {
    if (!extensions.length) {
      this.settings.detachAllExtensions()
    } else {
      extensions.forEach((extensionFolderName) => {
        const extensionInfo = this.getExtensionInfo(extensionFolderName, true)
        if (!extensionInfo) {
          return logger.warn(`There is no extension in folder: './extensions/${extensionFolderName}'. Skipping... Please make sure that you only pass the folder name of the extension as argument.`)
        }

        this.settings.detachExtension(extensionInfo.id)
      })
    }
  }

  /**
   * @return {String[]} extensionId[]
   */
  getAllExtensions () {
    const extensionsFolder = path.join(this.settings.getApplicationFolder(), AppSettings.EXTENSIONS_FOLDER)
    const files = fsEx.readdirSync(extensionsFolder)
    const exts = []
    files.forEach(file => {
      if (this.getExtensionInfo(file, true)) exts.push(file)
    })
    return exts
  }

  /**
   * @param {String} extensionName
   * @param {Boolean} ignoreNotExisting
   * @return {String} extensionId
   */
  getExtensionInfo (extensionName, ignoreNotExisting) {
    const extensionsFolder = path.join(this.settings.getApplicationFolder(), AppSettings.EXTENSIONS_FOLDER)
    const file = path.join(extensionsFolder, extensionName, 'extension-config.json')
    if (!fsEx.existsSync(file)) {
      if (!ignoreNotExisting) logger.error(`"${file}" does not exist`)
      return
    }

    try {
      const json = fsEx.readJSONSync(file)
      if (!json.id) return logger.warn(`"${file}" has no "id"-property`)
      return {
        id: json.id,
        trusted: json.trusted || false
      }
    } catch (e) {
      logger.warn(`"${file}" is invalid json`)
    }
  }
}

module.exports = ExtensionAction
