const chokidar = require('chokidar')
const path = require('path')
const AppSettings = require('../AppSettings')
const async = require('neo-async')

class PipelineWatcher {
  constructor (appSettings) {
    this.appFolder = appSettings.getApplicationFolder()
    this.options = {ignoreInitial: true}
  }

  start () {
    return new Promise((resolve) => {
      this.watcher = chokidar.watch(path.join(this.appFolder, AppSettings.EXTENSIONS_FOLDER, '**', 'pipelines', '*.json'), this.options)
      this.watcher.on('ready', () => resolve())
    })
  }

  on (event, fn) {
    this.watcher.on(event, fn)
  }

  close () {
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

module.exports = PipelineWatcher
