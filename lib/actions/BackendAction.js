const path = require('path')
const fsEx = require('fs-extra')
const jsonlint = require('jsonlint')
const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const BackendProcess = require('../app/backend/BackendProcess')
const ExtensionConfigWatcher = require('../app/ExtensionConfigWatcher')
const AttachedExtensionsWatcher = require('../app/AttachedExtensionsWatcher')
const logger = require('../logger')
const DcHttpClient = require('../DcHttpClient')
const PipelineWatcher = require('../app/backend/PipelineWatcher')
const CliProxy = require('../app/backend/CliProxy')
const utils = require('../utils/utils')
const StepExecutor = require('../app/backend/extensionRuntime/StepExecutor')

const { SETTINGS_FOLDER, EXTENSIONS_FOLDER, PIPELINES_FOLDER, TRUSTED_PIPELINES_FOLDER } = require('../app/Constants')

let reconnecting = false

class BackendAction {
  /**
   * @param {Command} caporal
   */
  static register (caporal) {
    caporal
      .command('backend start')
      .option('--inspect', 'allow inspection tools to connect for the debugging of backend extensions')
      .description('Establish a connection to the development system')
      .action((args, options) => { new BackendAction().run(options) })
  }

  constructor () {
    this.appSettings = new AppSettings().validate()
    this.pipelines = {}

    this.settingsFolder = path.join(this.appSettings.getApplicationFolder(), SETTINGS_FOLDER)
    this.pipelinesFolder = path.join(this.appSettings.getApplicationFolder(), PIPELINES_FOLDER)
    this.trustedPipelinesFolder = path.join(this.appSettings.getApplicationFolder(), TRUSTED_PIPELINES_FOLDER)
    this.userSettings = new UserSettings()
    this.dcClient = new DcHttpClient(this.userSettings, logger)
  }

  /**
   * @param {Object} cliOptions
   * @param {Boolean} cliOptions.inspect
   */
  async run (cliOptions) {
    this.userSettings.validate()

    const pid = await utils.previousProcess('backend', this.settingsFolder)
    if (pid) throw new Error(`Backend process is already running with pid: ${pid}. Please quit this process first.`)

    this.backendProcess = new BackendProcess(
      this.userSettings,
      this.appSettings,
      logger,
      new StepExecutor(logger, this.appSettings, Boolean(cliOptions.inspect))
    )

    await this.writeExtensionConfigs()

    this.extensionConfigWatcher = new ExtensionConfigWatcher(this.appSettings)
    this.pipelineWatcher = new PipelineWatcher(this.appSettings)
    this.attachedExtensionsWatcher = new AttachedExtensionsWatcher(this.appSettings)
    this.cliProxy = new CliProxy(this.appSettings, logger)

    await this._startSubProcess()

    this.backendProcess.on('reconnect', async () => {
      if (reconnecting) return logger.debug('already reconnecting ...')

      logger.debug('reconnecting ...')
      reconnecting = true
      await this.backendProcess.selectApplication(this.appSettings.getId())
      await this.backendProcess.resetPipelines()
      await this._uploadPipelinesOfAttachedExtenstions()
      await this._attachAllExtensions()

      await Promise.all([
        this._writeLocalPipelines(),
        this.backendProcess.reloadPipelineController()
      ])
      reconnecting = false
    })

    process.on('SIGINT', async () => {
      let exitCode = 0
      try {
        await this._stop()
      } catch (err) {
        logger.error(err)
        exitCode = 1
      }

      await utils.deleteProcessFile('backend', this.settingsFolder)
      process.exit(exitCode)
    })
  }

  async writeExtensionConfigs () {
    const attachedExtensions = this.appSettings.loadAttachedExtensions()
    const extensionsFolder = path.join(this.appSettings.getApplicationFolder(), EXTENSIONS_FOLDER)
    const promises = []
    for (let extensionId in attachedExtensions) {
      const extensionPath = path.join(extensionsFolder, attachedExtensions[extensionId].path)
      const config = await fsEx.readJson(path.join(extensionPath, 'extension-config.json'))
      promises.push(this._updateExtensionConfig({file: config, path: extensionPath}, this.appSettings.getId()))
    }
    return Promise.all(promises)
  }

  async _stop () {
    this.pipelineWatcher.close()
    await Promise.all([
      this.extensionConfigWatcher.stop(),
      this.attachedExtensionsWatcher.stop(),
      this.backendProcess.disconnect(),
      this.cliProxy.close()
    ])
    logger.info('SDK connection closed')
  }

  async _pipelineEvent (event, file) {
    const extensionFolder = path.join(this.appSettings.getApplicationFolder(), EXTENSIONS_FOLDER, path.sep)
    if (!this.pipelines[file]) this.pipelines[file] = {}
    if (this.pipelines[file].queued) return
    this.pipelines[file].queued = true

    // check if the extension of the pipeline is attached
    const attachedExtensions = this.attachedExtensionsWatcher.attachedExtensions
    const pathOfChangedExtension = file.replace(extensionFolder, '').split(path.sep)[0]
    let changedExtension = attachedExtensions.filter((extension) => { return extension.path === pathOfChangedExtension })
    if (changedExtension.length === 0) return logger.debug('The extension of the pipeline is not attached --> skip')

    changedExtension = changedExtension[0]
    setTimeout(async () => {
      this.pipelines[file].queued = false
      try {
        if (!await fsEx.pathExists(file)) {
          await this._pipelineRemoved(file, changedExtension.trusted)
          return
        }
      } catch (err) {
        return logger.error(err)
      }
      // pipelines was changed
      try {
        await this._pipelineChanged(file, changedExtension.trusted)
      } catch (err) {
        if (err.code === 'PIPELINE_INVALID') {
          const messageObj = JSON.parse(err.message)
          messageObj.errors.forEach(error => {
            logger.error({field: error.field}, `Pipeline invalid: ${error.message}`)
          })
          return
        }

        logger.error(`Error while uploading pipeline '${file}': ${err.message}`)
        if (err.code === 'STEP_NOT_FOUND') logger.warn('Check if the extension containing this step is attached')
      }
    }, 500)
  }

  async _startSubProcess () {
    const applicationId = this.appSettings.getId()
    await this.backendProcess.connect()
    await this.backendProcess.selectApplication(applicationId)
    await this.backendProcess.resetPipelines()
    await this._uploadPipelinesOfAttachedExtenstions()
    await this.backendProcess.startStepExecutor()
    await this._attachAllExtensions()

    await Promise.all([
      this._writeLocalPipelines(),
      this.backendProcess.reloadPipelineController()
    ])
    logger.info('Pipelines are now downloaded locally')

    // watcher
    await this.pipelineWatcher.start()
    await this.extensionConfigWatcher.start()
    await this.attachedExtensionsWatcher.start()
    this.pipelineWatcher.on('all', (event, file) => this._pipelineEvent(event, file))
    this.extensionConfigWatcher.on('configChange', (config) => this._updateExtensionConfig(config))
    this.attachedExtensionsWatcher.on('attach', (extensionInfo) => this.backendProcess.attachExtension(extensionInfo))
    this.attachedExtensionsWatcher.on('detach', (extensionInfo) => this.backendProcess.detachExtension(extensionInfo))

    try {
      await this.cliProxy.start()
      await utils.setProcessFile('backend', this.settingsFolder, process.pid)
    } catch (err) {
      throw new Error(`Could not start CLI-Proxy ${err}`)
    }
  }

  async _pipelineRemoved (file, trusted) {
    if (!this.pipelines[file] || !this.pipelines[file].id) return
    const pipelineId = this.pipelines[file].id
    logger.info(`Start removing pipeline: ${pipelineId}`)

    try {
      await this.dcClient.removePipeline(pipelineId, this.appSettings.getId())
      logger.info(`Removed pipeline '${pipelineId}'`)
      await this._writeLocalPipelines()
    } catch (err) {
      throw new Error(`Could not remove pipeline '${pipelineId}': ${err.message}`)
    }
  }

  async _writeLocalPipelines () {
    await Promise.all([
      (async () => {
        const pipelines = await this.dcClient.downloadPipelines(this.appSettings.getId(), false)
        await this._writePipelines(pipelines, this.pipelinesFolder)
      })(),
      (async () => {
        // download trusted pipelines
        const pipelines = await this.dcClient.downloadPipelines(this.appSettings.getId(), true)
        await this._writePipelines(pipelines, this.trustedPipelinesFolder)
      })()
    ])
  }

  /**
   * @param {string[]} pipelines
   * @param {string} folder
   */
  async _writePipelines (pipelines, folder) {
    await fsEx.emptyDir(folder)
    const promises = []
    pipelines.forEach((pipeline) => {
      const file = path.join(folder, `${pipeline.pipeline.id}.json`)
      promises.push(fsEx.writeJson(file, pipeline, {spaces: 2}))
    })
    await Promise.all(pipelines)
  }

  async _pipelineChanged (file, trusted) {
    const pipelineFileContent = await fsEx.readFile(file, 'utf8')
    let pipeline = jsonlint.parse(pipelineFileContent)

    if (!pipeline || !pipeline.pipeline || !pipeline.pipeline.id) throw new Error(`invalid pipeline; check the pipeline.id property in ${file}`)

    const fileName = path.basename(file, '.json')
    if (fileName !== pipeline.pipeline.id) throw new Error(`Pipeline ID "${pipeline.pipeline.id}" should match its file name!`)

    if (!this.pipelines[file]) this.pipelines[file] = {}
    this.pipelines[file].id = pipeline.pipeline.id
    logger.debug('Upload pipeline')
    await this.dcClient.uploadPipeline(pipeline, this.appSettings.getId(), trusted)

    // update pipeline in local pipelines folder
    logger.debug('Update pipeline file in pipelines folder')
    const pipelinePath = path.join(this.appSettings.getApplicationFolder(), (trusted) ? TRUSTED_PIPELINES_FOLDER : PIPELINES_FOLDER, `${pipeline.pipeline.id}.json`)
    await fsEx.writeJSON(pipelinePath, pipeline, {spaces: 2})

    logger.debug('Reload pipelines in the PLC ')
    await this.backendProcess.reloadPipelineController()
    logger.info(`Updated pipeline '${file}'`)
  }

  async _updateExtensionConfig (config) {
    try {
      const extConfig = await this.dcClient.generateExtensionConfig(config.file, this.appSettings.getId())

      if (extConfig.backend) {
        await fsEx.outputJson(path.join(config.path, 'extension', 'config.json'), extConfig.backend, {spaces: 2})
        logger.info(`Updated extension config for backend ${config.file.id}`)
      }
      if (extConfig.frontend) {
        await fsEx.outputJson(path.join(config.path, 'frontend', 'config.json'), extConfig.frontend, {spaces: 2})
        logger.info(`Updated extension config for frontend ${config.file.id}`)
      }
    } catch (err) {
      logger.error(new Error(`Could not generate config for '${config.file.id}': ${err.message}`))
      logger.debug(err)
    }
  }

  async _attachAllExtensions () {
    const attachedExtensions = this.appSettings.loadAttachedExtensions()
    const promises = []
    for (let extensionId in attachedExtensions) {
      attachedExtensions[extensionId].id = extensionId
      promises.push(this.backendProcess.attachExtension(attachedExtensions[extensionId]))
    }
    await Promise.all(promises)
  }

  async _uploadPipelinesOfAttachedExtenstions () {
    logger.info('Start syncing all local pipelines')
    const attachedExtensions = this.appSettings.loadAttachedExtensions()
    const extensionsFolder = path.join(this.appSettings.getApplicationFolder(), EXTENSIONS_FOLDER)

    let pipelines = []
    let trustedPipelines = []
    for (let extensionId in attachedExtensions) {
      const extension = attachedExtensions[extensionId]

      // get list of pipelines of the extension
      const pipelineFolder = path.join(extensionsFolder, extension.path, 'pipelines')
      let pipelinesFiles = await fsEx.readdir(pipelineFolder)
      pipelinesFiles = pipelinesFiles.filter((pipelineFile) => { return pipelineFile.endsWith('.json') && !pipelineFile.startsWith('.') })
      const promises = []

      // read pipelines
      for (let index in pipelinesFiles) promises.push(fsEx.readJSON(path.join(pipelineFolder, pipelinesFiles[index])))

      // once loaded, validate pipeline IDs vs pipeline file names; should be the same for each
      const loadedPipelines = await Promise.all(promises)
      let pipelineFileNameMismatches = []
      loadedPipelines.forEach((pipeline, index) => {
        if (pipeline.pipeline.id !== path.basename(pipelinesFiles[index], '.json')) {
          pipelineFileNameMismatches.push(
            `Pipeline ID "${pipeline.pipeline.id}" and file name "${path.basename(pipelinesFiles[index], '.json')}" mismatch! ` +
            'The ID of a pipeline and its file name should be the same.'
          )
        }
        const pipelinePath = path.join(pipelineFolder, pipelinesFiles[index])
        if (!this.pipelines[pipelinePath]) this.pipelines[pipelinePath] = {}
        this.pipelines[pipelinePath].id = pipeline.pipeline.id
      })

      if (pipelineFileNameMismatches.length > 0) throw new Error(pipelineFileNameMismatches.join('\n'))

      // group pipelines by trusted / untrusted
      if (extension.trusted === true) {
        trustedPipelines = trustedPipelines.concat(loadedPipelines)
      } else {
        pipelines = pipelines.concat(loadedPipelines)
      }
    }
    await Promise.all([
      this.dcClient.uploadMultiplePipelines(pipelines, this.appSettings.getId(), false),
      this.dcClient.uploadMultiplePipelines(trustedPipelines, this.appSettings.getId(), true)
    ])
    logger.info('All pipelines are in sync now')
  }
}

module.exports = BackendAction
