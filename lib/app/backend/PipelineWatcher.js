const chokidar = require('chokidar')
const path = require('path')
const AppSettings = require('../AppSettings')

class PipelineWatcher {
  constructor (appSettings) {
    this.appFolder = appSettings.getApplicationFolder()
    this.options = {ignoreInitial: true, useFsEvents: false}
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
    if (!this.watcher) return
    this.watcher.removeAllListeners()
    this.watcher.close()
  }
}

module.exports = PipelineWatcher
