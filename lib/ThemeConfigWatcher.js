const path = require('path')
const ExtensionConfigWatcher = require('./ExtensionConfigWatcher')

const THEME_FOLDER = 'themes'

class ThemeConfigWatcher extends ExtensionConfigWatcher {
  constructor (options) {
    options = options || {}
    const themeFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, THEME_FOLDER) : THEME_FOLDER
    super(options, themeFolder)
  }
}

module.exports = ThemeConfigWatcher
