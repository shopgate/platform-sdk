const chokidar = require('chokidar')
const path = require('path')
const fsEx = require('fs-extra')
const async = require('neo-async')
const EventEmitter = require('events')

const PIPELINES_FOLDER = 'pipelines'

class PipelineWatcher extends EventEmitter {

  constructor () {
    super()
    this.pipelineFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, PIPELINES_FOLDER) : PIPELINES_FOLDER
  }

  start () {
    this.watcher = chokidar.watch(this.pipelineFolder).on('all', (event, path) => {
      console.log("Changed", path)
      fsEx.readJson(path, (err, data) => {
        console.log(err, data)
        this.emit('pipelineChanged', data)
      })
    })
  }

  stop (cb = () => {}) {
    if (!this.watcher) return cb()

    this.watcher.close()
    async.retry({times: 5, interval: 10}, (acb) => {
      if (this.watcher.closed) return acb()
      acb(new Error('Not disconnected '))
    }, cb)
  }

}

module.exports = PipelineWatcher
