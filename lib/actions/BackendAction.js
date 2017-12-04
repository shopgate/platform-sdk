const path = require('path')
const async = require('neo-async')
const fsEx = require('fs-extra')
const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const BackendProcess = require('../app/backend/BackendProcess')
const ExtensionConfigWatcher = require('../app/ExtensionConfigWatcher')
const logger = require('../logger')
const DcHttpClient = require('../DcHttpClient')
const PipelineWatcher = require('../app/backend/PipelineWatcher')
const CliProxy = require('../CliProxy')

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

  constructor () {
    this.pipelines = {}
    this.pipelinesFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, AppSettings.PIPELINES_FOLDER) : AppSettings.PIPELINES_FOLDER
  }

  run (action) {
    if (!UserSettings.getInstance().getSession().getToken()) throw new Error('not logged in')

    if (action !== 'start') throw new Error(`unknown action "${action}"`)

    AppSettings.getInstance().init()
    this.dcClient = new DcHttpClient(UserSettings.getInstance())
    this.backendProcess = new BackendProcess()
    this.extensionConfigWatcher = new ExtensionConfigWatcher()
    this.pipelineWatcher = new PipelineWatcher()
    this.cliProxy = new CliProxy()

    this._startSubProcess()

    process.on('SIGINT', () => {
      this.pipelineWatcher.close()
      async.parallel([
        (cb) => this.extensionConfigWatcher.stop(cb),
        (cb) => this.backendProcess.attachedExtensionsWatcher.stop(cb),
        (cb) => this.backendProcess.disconnect(cb),
        (cb) => this.cliProxy.server.close(cb)
      ], (err) => {
        if (err) {
          logger.error(err)
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

      this.dcClient.downloadPipelines(AppSettings.getInstance().getId(), (err, pipelines) => {
        if (err) throw err
        this._writePipelines(pipelines, (err) => {
          if (err) throw err
          logger.info('Updated all pipelines, Backend is ready')
          this.pipelineWatcher.start(() => {
            this.pipelineWatcher.on('all', (event, file) => {
              fsEx.pathExists(file, (err, exists) => {
                if (err) return logger.error(err)

                if (!exists) {
                  return this._pipelineRemoved(file, (err) => {
                    if (err) logger.error(err.message)
                  })
                }
                this._pipelineChanged(file, (err) => {
                  if (err) logger.error(err.message)
                })
              })
            })
          })

          this.extensionConfigWatcher.start(() => {
            this.extensionConfigWatcher.on('configChange', (config) => this._extensionChanged(config))
          })

          this.cliProxy.start((err) => {
            if (err) logger.warn('Could not start CLI-Proxy', err)
          })
        })
      })
    })
  }

  _pipelineRemoved (file, cb) {
    const pipelineId = this.pipelines[file]
    delete this.pipelines[file]
    logger.info(`Start removing pipeline: ${pipelineId}`)

    async.retry({
      times: 5,
      interval: (count) => 100 * Math.pow(2, count)
    }, (acb) => {
      this.dcClient.removePipeline(pipelineId, AppSettings.getInstance().getId(), (err) => {
        if (err) logger.debug(err)
        acb(err)
      })
    }, (err) => {
      if (err) return cb(new Error(`Could not remove pipeline '${pipelineId}': ${err.message}`))
      logger.info(`Removed pipeline '${pipelineId}'`)
      cb()
    })
  }

  _writePipelines (pipelines, cb) {
    fsEx.emptyDir(this.pipelinesFolder, (err) => {
      if (err) return cb(err)
      async.each(pipelines, (pipeline, eCb) => {
        const file = path.join(this.pipelinesFolder, `${pipeline.pipeline.id}.json`)
        this.pipelines[file] = pipeline.pipeline.id
        fsEx.writeJson(file, pipeline, {spaces: 2}, eCb)
      }, cb)
    })
  }

  _pipelineChanged (file, cb) {
    fsEx.readJson(file, {throws: false}, (err, pipeline) => {
      if (err) return logger.error(`Could not read pipeline ${file}`, err)
      if (!pipeline || !pipeline.pipeline || !pipeline.pipeline.id) return cb(new Error('invalid pipeline'))
      this.pipelines[file] = pipeline.pipeline.id

      logger.info(`Start uploading pipeline '${pipeline.pipeline.id}'`)
      async.retry({
        times: 5,
        interval: (count) => 100 * Math.pow(2, count)
      }, (acb) => {
        this.dcClient.uploadPipeline(pipeline, AppSettings.getInstance().getId(), (err) => {
          if (err) logger.debug(err)
          acb(err)
        })
      }, (err) => {
        if (err) {
          if (err.message.startsWith('Pipeline step #')) {
            return cb(new Error(`Error while uploading pipeline '${pipeline.pipeline.id}'\n${err.message}\nCheck if the extension containing this step is attached`))
          }
          return cb(new Error(`Could not upload pipeline '${pipeline.pipeline.id}': ${err.message}`))
        }
        logger.info(`Updated pipeline '${pipeline.pipeline.id}'`)
        cb()
      })
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
