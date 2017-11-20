const path = require('path')
const chokidar = require('chokidar')
const fsEx = require('fs-extra')
const EventEmitter = require('events')

const {SETTINGS_FOLDER, EXTENSIONS_FILE} = require('./app/AppSettings')

class ExtensionWatcher extends EventEmitter {
  constructor (options) {
    super()
    const settingsFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, SETTINGS_FOLDER) : SETTINGS_FOLDER
    this.configPath = path.join(settingsFolder, EXTENSIONS_FILE)
    this.attachedExtensions = []
    this.options = options
  }

  start () {
    this.watcher = chokidar.watch(this.configPath, this.options).on('all', (event, path) => {
      fsEx.readJson(path, (err, config) => {
        if (err) throw err

        const updatedExtensions = Object.keys(config.attachedExtensions)

        // Add new Extensions
        updatedExtensions
          .filter((updated) => !this.attachedExtensions.includes(updated))
          .forEach(ext => {
            this.emit('attach', ext)
          })

        // Remove missing Extensions
        this.attachedExtensions
          .filter((old) => !updatedExtensions.includes(old))
          .forEach(ext => {
            this.emit('detach', ext)
          })

        this.attachedExtensions = updatedExtensions
      })
    })
  }

  close () {
    if (this.watcher) this.watcher.close()
  }
}

module.exports = ExtensionWatcher
