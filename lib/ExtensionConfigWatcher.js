const path = require('path')
const chokidar = require('chokidar')
const fsEx = require('fs-extra')
const async = require('neo-async')
const EventEmitter = require('events')

const EXTENSION_FOLDER = 'extensions'

class ExtensionConfigWatcher extends EventEmitter {
  constructor () {
    super()
    this.settingsFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, EXTENSION_FOLDER) : EXTENSION_FOLDER
  }

  start () {
    this.watcher = chokidar.watch(path.join(this.settingsFolder, '**', 'extension-config.json'), {ignoreInitial: true}).on('all', (event, path) => {
      fsEx.readJson(path, (err, config) => {
        if (err) throw err

        const parts = path.split('/')
        const extPath = parts.slice(0, parts.length - 1).join('/')

        this.emit('configChange', {file: config, path: extPath})
      })
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
}

module.exports = ExtensionConfigWatcher
