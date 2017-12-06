const chokidar = require('chokidar')
const path = require('path')
const {PIPELINES_FOLDER} = require('../AppSettings')

class PipelineWatcher {
  constructor () {
    this.pipelineFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, PIPELINES_FOLDER) : PIPELINES_FOLDER
    this.options = {ignoreInitial: true, useFsEvents: false}
  }

  start (cb) {
    this.watcher = chokidar.watch(path.join(this.pipelineFolder, '*.json'), this.options)
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
