const async = require('neo-async')
const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const BackendProcess = require('../app/backend/BackendProcess')
const PipelineWatcher = require('../PipelineWatcher')
const DCHttpClient = require('../DCHttpClient')
const logger = require('../logger')

class BackendAction {
  /**
   * @param {Command} commander
   */
  register (commander) {
    commander
      .command('backend <action>')
      .description('establish a connection to the development system')
      .action(this.run.bind(this))
  }

  run (action) {
    if (!UserSettings.getInstance().getSession().hasToken()) throw new Error('not logged in')

    if (action !== 'start') throw new Error(`unknown action "${action}"`)

    AppSettings.getInstance().init()
    this.backendProcess = new BackendProcess()
    this.dcClient = new DCHttpClient()
    this.pipelineWatcher = new PipelineWatcher()

    this._startSubProcess()

    process.on('SIGINT', () => {
      this.backendProcess.disconnect()
      this.backendProcess.extensionWatcher.close()
      this.pipelineWatcher.stop()
      logger.info('SDK connection closed')
      process.exit(0)
    })
  }

  _startSubProcess () {
    this.backendProcess.connect(err => {
      if (err) throw err

      this.pipelineWatcher
        .start()
        .on('pipelineChanged', (pipeline) => this._pipelineChanged(pipeline))
    })
  }

  _pipelineChanged (pipeline, cb = () => {}) {
    async.retry({
      times: 5,
      interval: (count) => { return count * 10 }
    }, (acb) => {
      this.dcClient.updatePipeline(pipeline, AppSettings.getInstance().getId(), UserSettings.getInstance().getSession(), (err) => {
        if (err) return acb(new Error(`Could not update pipeline '${pipeline.pipeline.id}'`))
        return acb()
      })
    }, (err) => {
      if (err) {
        logger.error(err.message)
        return cb(err)
      }
      logger.info(`Updated pipeline '${pipeline.pipeline.id}'`)
      cb()
    })
  }
}

module.exports = BackendAction
