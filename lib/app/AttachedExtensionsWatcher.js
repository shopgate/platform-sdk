const chokidar = require('chokidar')
const fsEx = require('fs-extra')
const async = require('neo-async')
const EventEmitter = require('events')

class AttachedExtensionsWatcher extends EventEmitter {
  constructor (appSettings) {
    super()
    this.configPath = appSettings.attachedExtensionsFile
    this.attachedExtensions = []
    this.options = {}
  }

  start (cb) {
    this.watcher = chokidar.watch(this.configPath, this.options)
    .on('all', (event, path) => {
      fsEx.readJson(path, (err, config) => {
        if (err) throw err

        const updatedExtensionsKeys = Object.keys(config.attachedExtensions)
        const updatedExtensions = []
        for (let i = 0; i < updatedExtensionsKeys.length; i++) {
          const item = config.attachedExtensions[updatedExtensionsKeys[i]]
          item.id = updatedExtensionsKeys[i]
          updatedExtensions.push(item)
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
