const path = require('path')
const chokidar = require('chokidar')
const fsEx = require('fs-extra')
const async = require('neo-async')
const EventEmitter = require('events')
const AppSettings = require('./AppSettings')

class ExtensionConfigWatcher extends EventEmitter {
  /**
   * @param {AppSettings} appSettings
   */
  constructor (appSettings) {
    super()
    this.watchFolder = path.join(appSettings.getApplicationFolder(), AppSettings.EXTENSIONS_FOLDER)
    this.options = {ignoreInitial: true}
    this.chokidar = chokidar
  }

  start () {
    return new Promise((resolve) => {
      this.watcher = this.chokidar.watch(path.join(this.watchFolder, '**', 'extension-config.json'), this.options).on('all', (event, configPath) => {
        fsEx.readJson(configPath, {throws: false}, (err, config) => {
          if (err || !config) return

          const parts = configPath.split(path.sep)
          const extPath = parts.slice(0, parts.length - 1).join(path.sep)

          this.emit('configChange', {file: config, path: extPath})
        })
      })
      .on('ready', () => resolve())
    })
  }

  stop () {
    return new Promise((resolve, reject) => {
      if (!this.watcher) return resolve()
      this.watcher.close()
      async.retry({times: 5, interval: 10}, (acb) => {
        if (this.watcher.closed) return acb()
        acb(new Error('Not disconnected'))
      }, (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }
}

module.exports = ExtensionConfigWatcher
