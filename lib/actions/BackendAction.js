const path = require('path')
const async = require('neo-async')
const fsEx = require('fs-extra')
const jsonlint = require('jsonlint')
const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const BackendProcess = require('../app/backend/BackendProcess')
const ExtensionConfigWatcher = require('../app/ExtensionConfigWatcher')
const logger = require('../logger')
const DcHttpClient = require('../DcHttpClient')
const PipelineWatcher = require('../app/backend/PipelineWatcher')
const CliProxy = require('../app/backend/CliProxy')
const utils = require('../utils/utils')

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
    this.settingsFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, AppSettings.SETTINGS_FOLDER) : AppSettings.SETTINGS_FOLDER
    this.pipelinesFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, AppSettings.PIPELINES_FOLDER) : AppSettings.PIPELINES_FOLDER
    this.trustedPipelinesFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, AppSettings.TRUSTED_PIPELINES_FOLDER) : AppSettings.TRUSTED_PIPELINES_FOLDER
  }

  run (action) {
    if (!UserSettings.getInstance().getSession().getToken()) throw new Error('You\'re not logged in! Please run `sgcloud login` again.')
    if (action !== 'start') throw new Error(`unknown action "${action}"`)

    const pid = utils.previousProcess('backend', this.settingsFolder)
    if (pid) throw new Error(`Backend process is already running with pid: ${pid}. Please quit this process first.`)

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
        (cb) => this.cliProxy.close(cb)
      ], (err) => {
        utils.deleteProcessFile('backend', this.settingsFolder)
        if (err) {
          logger.error(err)
          process.exit(1)
        }
        logger.info('SDK connection closed')
        process.exit(0)
      })
    })
  }

  _pipelineEvent (event, file) {
    if (!this.pipelines[file]) this.pipelines[file] = {}
    if (this.pipelines[file].queued) return
    this.pipelines[file].queued = true
    setTimeout(() => {
      fsEx.pathExists(file, (err, exists) => {
        this.pipelines[file].queued = false
        if (err) return logger.error(err)
        if (!exists) {
          return this._pipelineRemoved(file, (err) => {
            if (err) logger.error(err.message)
          })
        }
        logger.info(`Start uploading pipeline '${file}'`)
        this._pipelineChanged(file, (err, pipelineId) => {
          if (err) {
            if (err.code === 'PIPELINE_INVALID') {
              const messageObj = JSON.parse(err.message)
              messageObj.errors.forEach(error => {
                logger.error({field: error.field}, `Pipeline invalid: ${error.message}`)
              })
              return
            }

            logger.error(`Error while uploading pipeline '${file}': ${err.message}`)
            if (err.code === 'STEP_NOT_FOUND') logger.info('Check if the extension containing this step is attached')
            return
          }
          logger.info(`Updated pipeline '${file}'`)
        })
      })
    }, 500)
  }

  _startSubProcess () {
    this.backendProcess.connect(err => {
      if (err) throw err
      logger.info('Updating pipelines...')

      this._writeLocalPipelines((err) => {
        if (err) throw err
        logger.info('Updated all pipelines, Backend is ready')
        this.pipelineWatcher.start(() => {
          this.pipelineWatcher.on('all', (event, file) => this._pipelineEvent(event, file))
        })

        this.extensionConfigWatcher.start(() => {
          this.extensionConfigWatcher.on('configChange', (config) => this._extensionChanged(config))
        })

        this.cliProxy.start((err) => {
          if (err) return logger.warn('Could not start CLI-Proxy', err)
          utils.setProcessFile('backend', this.settingsFolder, process.pid)
        })
      })
    })
  }

  _pipelineRemoved (file, cb) {
    if (!this.pipelines[file] || !this.pipelines[file].id) return cb()
    const pipelineId = this.pipelines[file].id
    logger.info(`Start removing pipeline: ${pipelineId}`)

    async.retry({
      times: 5,
      interval: (count) => 100 * Math.pow(2, count)
    }, (acb) => {
      this.dcClient.removePipeline(pipelineId, AppSettings.getInstance().getId(), file.includes(AppSettings.TRUSTED_PIPELINES_FOLDER), (err) => {
        if (err) logger.debug(err)
        acb(err)
      })
    }, (err) => {
      if (err) return cb(new Error(`Could not remove pipeline '${pipelineId}': ${err.message}`))
      logger.info(`Removed pipeline '${pipelineId}'`)
      cb()
    })
  }

  _writeLocalPipelines (cb) {
    async.parallel([
      tcb => this.dcClient.downloadPipelines(AppSettings.getInstance().getId(), false, (err, pipelines) => {
        if (err) tcb(err)
        this._writePipelines(pipelines, this.pipelinesFolder, tcb)
      }),
      tcb => this.dcClient.downloadPipelines(AppSettings.getInstance().getId(), true, (err, pipelines) => {
        if (err) tcb(err)
        this._writePipelines(pipelines, this.trustedPipelinesFolder, tcb)
      })
    ], cb)
  }

  _writePipelines (pipelines, folder, cb) {
    fsEx.emptyDir(folder, (err) => {
      if (err) return cb(err)
      async.each(pipelines, (pipeline, eCb) => {
        const file = path.join(folder, `${pipeline.pipeline.id}.json`)
        if (!this.pipelines[file]) this.pipelines[file] = {}
        this.pipelines[file].id = pipeline.pipeline.id
        fsEx.writeJson(file, pipeline, {spaces: 2}, eCb)
      }, cb)
    })
  }

  _pipelineChanged (file, cb) {
    fsEx.readFile(file, 'utf8', (err, pipelineFileContent) => {
      if (err) return cb(err)

      let pipeline = null
      try {
        pipeline = jsonlint.parse(pipelineFileContent)
      } catch (err) {
        return cb(err)
      }

      if (!pipeline || !pipeline.pipeline || !pipeline.pipeline.id) return cb(new Error(`invalid pipeline; check the pipeline.id property in ${file}`))
      const fileName = path.basename(file, '.json')
      if (fileName !== pipeline.pipeline.id) return cb(new Error('The pipeline id and the file name need to be equal! Please make sure you changed both places'))

      if (!this.pipelines[file]) this.pipelines[file] = {}
      this.pipelines[file].id = pipeline.pipeline.id

      let retries = 5
      let lastError
      async.whilst(
        () => retries > 0,
        (wcb) => {
          setTimeout(() => {
            this.dcClient.uploadPipeline(pipeline, AppSettings.getInstance().getId(), file.includes(AppSettings.TRUSTED_PIPELINES_FOLDER), (err) => {
              lastError = err
              if (err) {
                logger.debug(err)
                if (err.statusCode === 400 || err.code === 'STEP_NOT_FOUND' || retries <= 1) {
                  return wcb(err)
                }
              } else {
                retries = 0
              }
              wcb()
            })
          }, 100 * Math.pow(2, 5 - retries--))
        },
        (err) => cb(err || lastError)
      )
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
