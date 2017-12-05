const chokidar = require('chokidar')
const path = require('path')
const {PIPELINES_FOLDER, TRUSTED_PIPELINES_FOLDER} = require('../AppSettings')

class PipelineWatcher {
  constructor (options) {
    this.appFolder = process.env.APP_PATH ? process.env.APP_PATH : '.'
    this.options = options || {}
    this.options.ignoreInitial = true
    this.options.useFsEvents = false
  }

  start (cb) {
    this.watcher = chokidar.watch(path.join(this.appFolder, '**', '*.json'), this.options)
    this.watcher.on('ready', () => cb())
  }

  on (event, fn) {
    this.watcher.on(event, (event, file) => {
      if (file.includes(PIPELINES_FOLDER) || file.includes(TRUSTED_PIPELINES_FOLDER)) {
        return fn(event, file)
      }
    })
  }

  close () {
    if (!this.watcher) return
    this.watcher.removeAllListeners()
    this.watcher.close()
  }
}

module.exports = PipelineWatcher
