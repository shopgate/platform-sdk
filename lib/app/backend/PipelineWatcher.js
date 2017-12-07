const chokidar = require('chokidar')
const path = require('path')

class PipelineWatcher {
  constructor (options) {
    this.appFolder = process.env.APP_PATH ? process.env.APP_PATH : '.'
    this.options = options || {}
    this.options.ignoreInitial = true
    this.options.useFsEvents = false
  }

  start (cb) {
    this.watcher = chokidar.watch(path.join(this.appFolder, '*ipelines', '*.json'), this.options)
    this.watcher.on('ready', () => cb())
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
