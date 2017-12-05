const path = require('path')
const ExtensionConfigWatcher = require('../ExtensionConfigWatcher')
const AppSettings = require('../AppSettings')

class ThemeConfigWatcher extends ExtensionConfigWatcher {
  constructor (options) {
    super(options)
    this.watchFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, AppSettings.THEME_FOLDER) : AppSettings.THEME_FOLDER
  }
}

module.exports = ThemeConfigWatcher
