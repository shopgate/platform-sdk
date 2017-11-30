const path = require('path')
const ExtensionConfigWatcher = require('../ExtensionConfigWatcher')

const THEME_FOLDER = 'themes'

class ThemeConfigWatcher extends ExtensionConfigWatcher {
  constructor (options) {
    super(options)
    this.watchFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, THEME_FOLDER) : THEME_FOLDER
  }
}

module.exports = ThemeConfigWatcher
