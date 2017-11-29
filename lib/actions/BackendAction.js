const path = require('path')
const async = require('neo-async')
const fsEx = require('fs-extra')
const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const BackendProcess = require('../app/backend/BackendProcess')
const ExtensionConfigWatcher = require('../ExtensionConfigWatcher')
const logger = require('../logger')
const DcHttpClient = require('../DcHttpClient')
const PipelineWatcher = require('../app/backend/PipelineWatcher')

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
    this.extensionConfigWatcher = new ExtensionConfigWatcher()
    this.pipelineWatcher = new PipelineWatcher()

    this._startSubProcess()

    process.on('SIGINT', () => {
      this.pipelineWatcher.close()
      async.parallel([
        (cb) => this.extensionConfigWatcher.stop(cb),
        (cb) => this.backendProcess.extensionWatcher.stop(cb),
        (cb) => this.backendProcess.disconnect(cb)
      ], (err) => {
        if (err) {
          this.log.error(err)
          process.exit(1)
        }
        logger.info('SDK connection closed')
        process.exit(0)
      })
    })
  }

  _startSubProcess () {
    this.backendProcess.connect(err => {
      if (err) throw err
      logger.info('Updating pipelines...')

      this.dcClient.getPipelines(AppSettings.getInstance().getId(), (err, pipelines) => {
        if (err) throw err
        this._updatePipelines(pipelines, (err) => {
          if (err) throw err
          logger.info('Updated all pipelines, Backend is ready')
          this.pipelineWatcher.start(() => {
            this.pipelineWatcher.on('all', (event, file) => {
              fsEx.readJson(file, (err, data) => {
                if (err) {
                  logger.error(`Could not read pipeline ${file}`, err)
                  return
                }
                this._pipelineChanged(data)
              })
            })
          })

          this.extensionConfigWatcher.start(() => {
            this.extensionConfigWatcher.on('configChange', (config) => this._extensionChanged(config))
          })
        })
      })
    })
  }

  _updatePipelines (pipelines, cb) {
    const pipelineFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, AppSettings.PIPELINES_FOLDER) : AppSettings.PIPELINES_FOLDER

    fsEx.emptyDir(pipelineFolder, (err) => {
      if (err) return cb(err)
      async.each(pipelines, (pipeline, eCb) => fsEx.writeJson(path.join(pipelineFolder, `${pipeline.pipeline.id}.json`), pipeline, {spaces: 2}, eCb), (err) => {
        if (err) return cb(err)
        cb()
      })
    })
  }

  _pipelineChanged (pipeline, cb = () => {}) {
    async.retry({
      times: 5,
      interval: (count) => 100 * Math.pow(2, count)
    }, (acb) => {
      this.dcClient.updatePipeline(pipeline, AppSettings.getInstance().getId(), (err) => {
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

  _extensionChanged (config, cb = () => {}) {
    async.retry({
      times: 5,
      interval: (count) => { return 100 * Math.pow(2, count) }
    }, (acb) => {
      this.dcClient.generateExtensionConfig(config.file, AppSettings.getInstance().getId(), (err, extConfig) => {
        if (err) return acb(new Error(`Could not generate Config for '${config.file.id}'`))
        return acb(null, extConfig)
      })
    }, (err, extConfig) => {
      if (err) return

      if (extConfig.backend) {
        fsEx.outputJsonSync(path.join('', config.path, 'extension', 'config.json'), extConfig.backend, {spaces: 2})
        logger.info(`Updated extension config for backend ${config.file.id}`)
      }

      if (extConfig.frontend) {
        fsEx.outputJsonSync(path.join('', config.path, 'frontend', 'config.json'), extConfig.frontend, {spaces: 2})
        logger.info(`Updated extension config for frontend ${config.file.id}`)
      }
      cb()
    })
  }
}

module.exports = BackendAction
