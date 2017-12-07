const path = require('path')
const chokidar = require('chokidar')
const fsEx = require('fs-extra')
const async = require('neo-async')
const EventEmitter = require('events')

const {SETTINGS_FOLDER, EXTENSIONS_FILE} = require('./AppSettings')

class AttachedExtensionsWatcher extends EventEmitter {
  constructor (options) {
    super()
    const settingsFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, SETTINGS_FOLDER) : SETTINGS_FOLDER
    this.configPath = path.join(settingsFolder, EXTENSIONS_FILE)
    this.attachedExtensions = []
    this.options = options || {}
  }

  start (cb) {
    this.watcher = chokidar.watch(this.configPath, this.options)
    .on('all', (event, path) => {
      fsEx.readJson(path, (err, config) => {
        if (err) throw err

        // TODO: build this with object
        const updatedExtensionsKeys = Object.keys(config.attachedExtensions)
        const updatedExtensions = []
        for (let i = 0; i < updatedExtensionsKeys.length; i++) {
          updatedExtensions.push(config.attachedExtensions[updatedExtensionsKeys[i]])
        }

        // Add new extensions
        updatedExtensions
          .filter((updated) => {
            for (let i = 0; i < this.attachedExtensions.length; i++) {
              if (updated.id === this.attachedExtensions[i].id) return false
            }
            return true
          })
          .forEach(ext => this.emit('attach', ext))

        // Remove detached extensions
        this.attachedExtensions
          .filter((old) => {
            for (let i = 0; i < updatedExtensions.length; i++) {
              if (old.id === updatedExtensions[i].id) return false
            }
            return true
          })
          .forEach(ext => this.emit('detach', ext))

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

module.exports = AttachedExtensionsWatcher
