const path = require('path')
const chokidar = require('chokidar')
const fsEx = require('fs-extra')
const async = require('neo-async')

const SETTINGS_FOLDER = require('./app/AppSettings').SETTINGS_FOLDER
const EXTENSIONS_FILE = require('./app/AppSettings').EXTENSIONS_FILE

class ExtensionWatcher {
  constructor () {
    const settingsFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, SETTINGS_FOLDER) : SETTINGS_FOLDER
    this.configPath = path.join(settingsFolder, EXTENSIONS_FILE)
    this.attachedExtensions = []
  }

  start () {
    if (!this.onAttach || !this.onDetach) throw new Error('You should register Attach and Detach in ExtensionWatcher, before you call start')

    this.watcher = chokidar.watch(this.configPath).on('all', (event, path) => {
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

  close (cb = () => {}) {
    if (!this.watcher) return cb()

    this.watcher.close()
    async.retry({times: 5, interval: 10}, (acb) => {
      if (this.watcher.closed) return acb()
      acb(new Error('Not disconnected '))
    }, cb)
  }

  registerAttach (method) {
    this.onAttach = method
  }

  registerDetach (method) {
    this.onDetach = method
  }
}

module.exports = ExtensionWatcher
