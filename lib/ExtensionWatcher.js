const path = require('path')
const chokidar = require('chokidar')
const fsEx = require('fs-extra')
const async = require('neo-async')
const EventEmitter = require('events')

const {SETTINGS_FOLDER, EXTENSIONS_FILE} = require('./app/AppSettings')

class ExtensionWatcher extends EventEmitter {
  constructor (options) {
    super()
    const settingsFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, SETTINGS_FOLDER) : SETTINGS_FOLDER
    this.configPath = path.join(settingsFolder, EXTENSIONS_FILE)
    this.attachedExtensions = []
    this.options = options || {}
    // this.options.ignoreInitial = true
  }

  start (cb) {
    this.watcher = chokidar.watch(this.configPath, this.options)
    .on('all', (event, path) => {
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
    .on('ready', () => cb())
  }

  stop (cb) {
    if (!this.watcher) return cb()

    this.watcher.close()
    async.retry({times: 5, interval: 10}, (acb) => {
      if (this.watcher.closed) return acb()
      acb(new Error('Not disconnected'))
    }, cb)
  }
}

module.exports = ExtensionWatcher
