const chokidar = require('chokidar')
const path = require('path')
const fsEx = require('fs-extra')
const async = require('neo-async')
const EventEmitter = require('events')
const logger = require('./logger')

const PIPELINES_FOLDER = 'pipelines'

class PipelineWatcher extends EventEmitter {
  constructor (options) {
    super()
    this.pipelineFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, PIPELINES_FOLDER) : PIPELINES_FOLDER
    this.options = options || {}
    this.options.ignoreInitial = true
  }

  start (cb = () => {}) {
    this.watcher = chokidar.watch(path.join(this.pipelineFolder, '*'), this.options).on('all', (event, path) => {
      fsEx.readJson(path, (err, data) => {
        if (err) {
          logger.error(`Could not read pipeline ${path}`, err)
          return
        }
        this.emit('pipelineChanged', data)
      })
    }).on('ready', () => cb())
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

module.exports = PipelineWatcher
