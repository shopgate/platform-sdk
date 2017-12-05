const path = require('path')
const fsEx = require('fs-extra')
const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const logger = require('../logger')

class ExtensionAction {
  /**
   * @param {Command} commander
   */
  register (commander) {
    commander
      .command('extension <action> [extensions...]')
      .description('attaches or detaches one or more extensions')
      .action(this.run.bind(this))
  }

  /**
   * @param {String} action
   * @param {String[]} [extensions]
   */
  run (action, extensions) {
    if (!UserSettings.getInstance().getSession().getToken()) throw new Error('not logged in')
    this.settings = AppSettings.getInstance()

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
      const extensionId = this.getExtensionId(extensionFolderName, true)
      if (!extensionId) {
        return logger.warn(`There is no extension in folder: './extensions/${extensionFolderName}'. Skipping... Please make sure that you only pass the folder name of the extension as argument.`)
      }
      this.settings.attachExtension(extensionFolderName, extensionId, force)
    })
    this.settings.save()
  }

  /**
   * @param {String[]} extensions
   */
  detachExtensions (extensions) {
    if (!extensions.length) {
      this.settings.detachAllExtensions().save()
    } else {
      extensions.forEach((extensionFolderName) => {
        const extensionId = this.getExtensionId(extensionFolderName, true)
        if (!extensionId) {
          return logger.warn(`There is no extension in folder: './extensions/${extensionFolderName}'. Skipping... Please make sure that you only pass the folder name of the extension as argument.`)
        }
        this.settings.detachExtension(extensionId)
      })
      this.settings.save()
    }
  }

  /**
   * @return {String[]} extensionId[]
   */
  getAllExtensions () {
    const extensionsFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, AppSettings.EXTENSIONS_FOLDER) : AppSettings.EXTENSIONS_FOLDER
    const files = fsEx.readdirSync(extensionsFolder)
    const exts = []
    files.forEach(file => {
      if (this.getExtensionId(file, true)) exts.push(file)
    })
    return exts
  }

  /**
   * @param {String} extensionName
   * @param {Boolean} ignoreNotExisting
   * @return {String} extensionId
   */
  getExtensionId (extensionName, ignoreNotExisting) {
    const extensionsFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, AppSettings.EXTENSIONS_FOLDER) : AppSettings.EXTENSIONS_FOLDER
    const file = path.join(extensionsFolder, extensionName, 'extension-config.json')
    if (!fsEx.existsSync(file)) {
      if (!ignoreNotExisting) logger.error(`"${file}" does not exist`)
      return
    }

    try {
      const json = fsEx.readJSONSync(file)
      if (json.id) return json.id
      logger.warn(`"${file}" has no "id"-property`)
    } catch (e) {
      logger.warn(`"${file}" is invalid json`)
    }
  }
}

module.exports = ExtensionAction
