const path = require('path')
const async = require('neo-async')
const fsEx = require('fs-extra')
const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const BackendProcess = require('../app/backend/BackendProcess')
const ExtensionConfigWatcher = require('../ExtensionConfigWatcher')
const ThemeConfigWatcher = require('../ThemeConfigWatcher')
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
    this.extensionConfigWatcher = new ExtensionConfigWatcher()
    this.themeConfigWatcher = new ThemeConfigWatcher()

    this._startSubProcess()

    process.on('SIGINT', () => {
      async.parallel([
        (cb) => this.pipelineWatcher.stop(cb),
        (cb) => this.extensionConfigWatcher.stop(cb),
        (cb) => this.themeConfigWatcher.stop(cb),
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
        this._updatePipelines(pipelines)
        logger.info('Updated all pipelines, Backend is ready')

        this.pipelineWatcher
          .start()
          .on('pipelineChanged', (pipeline) => this._pipelineChanged(pipeline))

        this.extensionConfigWatcher
          .start()
          .on('configChange', (config) => this._extensionChanged(config))

        this.themeConfigWatcher
          .start()
          .on('configChange', (config) => this._themeChanged(config))
      })
    })
  }

  _updatePipelines (pipelines) {
    const pipelineFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, AppSettings.PIPELINES_FOLDER) : AppSettings.PIPELINES_FOLDER

    fsEx.emptyDirSync(pipelineFolder)
    pipelines.forEach(pipeline => {
      fsEx.outputFileSync(path.join(pipelineFolder, `${pipeline.pipeline.id}.json`), JSON.stringify(pipeline, null, 2), 'UTF-8')
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

  _themeChanged (config, cb = () => {}) {
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
      fsEx.outputJsonSync(path.join('', config.path, 'config', 'app.json'), extConfig, {spaces: 2})
      logger.info(`Updated theme config ${config.file.id}`)
      cb()
    })
  }
}

module.exports = BackendAction
