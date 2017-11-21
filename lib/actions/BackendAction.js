const path = require('path')
const async = require('neo-async')
const fsEx = require('fs-extra')
const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const BackendProcess = require('../app/backend/BackendProcess')
const logger = require('../logger')
const DcHttpClient = require('../DcHttpClient')
const PipelineWatcher = require('../PipelineWatcher')

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
    if (!UserSettings.getInstance().getSession().getToken()) throw new Error('not logged in')

    if (action !== 'start') throw new Error(`unknown action "${action}"`)

    AppSettings.getInstance().init()
    this.dcClient = new DcHttpClient(UserSettings.getInstance())
    this.backendProcess = new BackendProcess()
    this.pipelineWatcher = new PipelineWatcher()

    this._startSubProcess()

    process.on('SIGINT', () => {
      this.backendProcess.disconnect()
      this.backendProcess.extensionWatcher.close()
      logger.info('SDK connection closed')
      process.exit(0)
    })
  }

  _startSubProcess () {
    this.backendProcess.connect(err => {
      if (err) throw err
      logger.info('Updating pipelines...')

      this.dcClient.getPipelines(AppSettings.getInstance().getId(), (err, pipelines) => {
        if (err) throw err
        this._updatePipelines(pipelines)
        logger.info('Updated all pipelines')

        this.pipelineWatcher
          .start()
          .on('pipelineChanged', (pipeline) => this._pipelineChanged(pipeline))
      })
    })
  }

  _updatePipelines (pipelines) {
    const pipelineFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, 'pipelines') : 'pipelines'

    fsEx.emptyDirSync(pipelineFolder)
    pipelines.forEach(pipeline => {
      fsEx.outputFileSync(path.join(pipelineFolder, `${pipeline.pipeline.id}.json`), JSON.stringify(pipeline, null, 2), 'UTF-8')
    })
  }

  _pipelineChanged (pipeline, cb = () => {}) {
    async.retry({
      times: 5,
      interval: (count) => { return count * 10 }
    }, (acb) => {
      this.dcClient.updatePipeline(pipeline, AppSettings.getInstance().getId(), (err) => {
        if (err) return acb(new Error(`Could not update pipeline '${pipeline.pipeline.id}'`))
        return acb()
      })
    }, (err) => {
      if (err) {
        logger.info(err.message)
        // logger.error(err.message)
        return cb(err)
      }
      logger.info(`Updated pipeline '${pipeline.pipeline.id}'`)
      cb()
    })
  }
}

module.exports = BackendAction
