const chokidar = require('chokidar')
const path = require('path')
const async = require('neo-async')

const { EXTENSIONS_FOLDER, PIPELINES_FOLDER } = require('../../../lib/app/Constants')

class PipelineWatcher {
  /**
   * @param {AppSettings} appSettings
   */
  constructor (appSettings) {
    this.appFolder = appSettings.getApplicationFolder()
    this.options = { ignoreInitial: true }
    this.chokidar = chokidar
  }

  start () {
    return new Promise((resolve) => {
      this.watcher = this.chokidar.watch(path.join(this.appFolder, EXTENSIONS_FOLDER, '*', PIPELINES_FOLDER, '*.json'), this.options)
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
      async.retry({ times: 5, interval: 10 }, (acb) => {
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
