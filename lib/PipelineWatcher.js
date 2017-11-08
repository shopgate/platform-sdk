const chokidar = require('chokidar')
const path = require('path')
const async = require('neo-async')
const fsEx = require('fs-extra')
const DCHttpClient = require('./DCHttpClient')

const PIPELINE_FOLDER = 'pipelines'

class PipelineWatcher {
  constructor () {
    this.pipelineFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, PIPELINE_FOLDER) : PIPELINE_FOLDER
    this.dcClient = new DCHttpClient()
  }

  start () {
    this.watcher = chokidar.watch(this.pipelineFolder).on('all', (event, path) => {
    })
  }

  stop (cb) {
    if (!this.watcher) return cb()

    this.watcher.close()
    async.retry({times: 5, interval: 10}, (acb) => {
      if (this.watcher.closed) return acb()
      acb(new Error('Not disconnected '))
    }, cb)
  }
}

module.exports = PipelineWatcher
