const path = require('path')
const chokidar = require('chokidar')
const fsEx = require('fs-extra')

const SETTINGS_FOLDER = require('./app/AppSettings').SETTINGS_FOLDER
const EXTENSIONS_FILE = require('./app/AppSettings').EXTENSIONS_FILE

class ExtensionWatcher {
  constructor () {
    const settingsFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, SETTINGS_FOLDER) : SETTINGS_FOLDER
    this.configPath = path.join(settingsFolder, EXTENSIONS_FILE)
    this.attachedExtensions = []
  }

  start () {
    if (!this.onAttach || !this.onDetach) throw new Error('You should register Attach and Detach in ExtensionWatcher, beofre you call start')

    chokidar.watch(this.configPath).on('all', (event, path) => {
      const config = fsEx.readJSONSync(path)

      const updatedExtensions = Object.keys(config.attachedExtensions)

      // Add new Extensions
      updatedExtensions
        .filter((updated) => !this.attachedExtensions.includes(updated))
        .forEach(ext => {
          this.onAttach(ext)
        })

      // Remove missing Extensions
      this.attachedExtensions
        .filter((old) => !updatedExtensions.includes(old))
        .forEach(ext => {
          this.onDetach(ext)
        })

      this.attachedExtensions = updatedExtensions
    })
  }

  registerAttach (method) {
    this.onAttach = method
  }

  registerDetach (method) {
    this.onDetach = method
  }
}

module.exports = ExtensionWatcher
