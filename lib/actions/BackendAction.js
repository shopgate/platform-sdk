const path = require('path')
const fsEx = require('fs-extra')
const jsonlint = require('jsonlint')
const BackendProcess = require('../app/backend/BackendProcess')
const ExtensionConfigWatcher = require('../app/ExtensionConfigWatcher')
const AttachedExtensionsWatcher = require('../app/AttachedExtensionsWatcher')
const { extensionConfigChanged } = require('../utils/EventHandler')
const logger = require('../logger')
const PipelineWatcher = require('../app/backend/PipelineWatcher')
const CliProxy = require('../app/backend/CliProxy')
const utils = require('../utils/utils')
const StepExecutor = require('../app/backend/extensionRuntime/StepExecutor')
const t = require('../i18n')(__filename)
// @ts-check

const { SETTINGS_FOLDER, EXTENSIONS_FOLDER, PIPELINES_FOLDER, TRUSTED_PIPELINES_FOLDER } = require('../app/Constants')

let reconnecting = false

class BackendAction {
  /**
   * @param {Command} caporal
   * @param {Internal.AppSettings} appSettings
   * @param {Internal.UserSettings} userSettings
   * @param {Internal.DcHttpClient} dcHttpClient
   */
  static register (caporal, appSettings, userSettings, dcHttpClient) {
    caporal
      .command('backend start')
      .option('--inspect', t('START_INSPECT_DESCRIPTION'))
      .description(t('START_DESCRIPTION'))
      .action(async (args, options) => {
        // Get SIGINT on windows (for CYGWIN and CMD)
        if (/^win/.test(process.platform)) {
          const rl = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
          })

          rl.on('SIGINT', () => {
            process.emit('SIGINT')
          })
        }

        try {
          await new BackendAction(appSettings, userSettings, dcHttpClient).run(options)
        } catch (err) /* istanbul ignore next */ {
          logger.error(err.message)
          process.exit(1)
        }
      })
  }

  /**
   * @param {Internal.AppSettings} appSettings
   * @param {Internal.UserSettings} userSettings
   * @param {Internal.DcHttpClient} dcHttpClient
   */
  constructor (appSettings, userSettings, dcHttpClient) {
    this.appSettings = appSettings
    this.userSettings = userSettings
    this.dcHttpClient = dcHttpClient
    this.pipelines = {}

    this.settingsFolder = path.join(this.appSettings.getApplicationFolder(), SETTINGS_FOLDER)
    this.pipelinesFolder = path.join(this.appSettings.getApplicationFolder(), PIPELINES_FOLDER)
    this.trustedPipelinesFolder = path.join(this.appSettings.getApplicationFolder(), TRUSTED_PIPELINES_FOLDER)
  }

  /**
   * @param {Object} cliOptions
   * @param {Boolean} cliOptions.inspect
   */
  async run (cliOptions) {
    await this.appSettings.validate()
    await this.userSettings.validate()

    const pid = await utils.getProcessId('backend', this.settingsFolder)
    if (pid) throw new Error(t('ERROR_BACKEND_ALREADY_RUNNING', { pid }))

    await this.dcHttpClient.checkPermissions(await this.appSettings.getId())
    await this.validateExtensionConfigs()

    this.backendProcess = new BackendProcess(
      this.userSettings,
      logger,
      new StepExecutor(logger, this.appSettings, this.dcHttpClient, Boolean(cliOptions.inspect))
    )

    await this.writeExtensionConfigs()
    this.extensionConfigWatcher = new ExtensionConfigWatcher(this.appSettings)
    this.pipelineWatcher = new PipelineWatcher(this.appSettings)
    this.attachedExtensionsWatcher = new AttachedExtensionsWatcher(this.appSettings)
    this.cliProxy = new CliProxy(this.appSettings, logger)
    await this._startSubProcess()
    this.backendProcess.on('reconnect', async () => {
      if (reconnecting) return logger.debug(t('ALREADY_RECONNECTING'))

      const appId = await this.appSettings.getId()

      logger.debug(t('RECONNECTING'))
      reconnecting = true
      await this.backendProcess.selectApplication(appId)
      await this.backendProcess.resetHooks()
      await this.backendProcess.resetPipelines()
      await this._uploadPipelinesOfAttachedExtenstions()
      await this.pushHooks()
      await this._attachAllExtensions()
      await Promise.all([
        utils.writeLocalPipelines(this.appSettings, this.dcHttpClient, appId, this.pipelinesFolder, this.trustedPipelinesFolder),
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
    return utils.writeExtensionConfigs(this.appSettings, this.dcHttpClient)
  }

  async validateExtensionConfigs () {
    return utils.validateExtensionConfigs(this.appSettings)
  }

  async pushHooks () {
    return utils.pushHooks(this.appSettings, this.dcHttpClient)
  }

  async _stop () {
    this.pipelineWatcher.close()
    await Promise.all([
      this.extensionConfigWatcher.stop(),
      this.attachedExtensionsWatcher.stop(),
      this.backendProcess.disconnect(),
      this.cliProxy.close()
    ])
    logger.info(t('SDK_CONNECTION_CLOSED'))
  }

  /**
   * @param {Object} event
   * @param {string} file
   */
  async _pipelineEvent (event, file) {
    const extensionFolder = path.join(this.appSettings.getApplicationFolder(), EXTENSIONS_FOLDER, path.sep)
    if (!this.pipelines[file]) this.pipelines[file] = {}
    if (this.pipelines[file].queued) return
    this.pipelines[file].queued = true

    // check if the extension of the pipeline is attached
    const attachedExtensions = this.attachedExtensionsWatcher.attachedExtensions
    const pathOfChangedExtension = file.replace(extensionFolder, '').split(path.sep)[0]
    let changedExtension = attachedExtensions.filter((extension) => { return extension.path === pathOfChangedExtension })
    if (changedExtension.length === 0) return logger.debug(t('PIPELINE_EXTENSION_NOT_ATTACHED'))

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
            logger.error({ field: error.field }, t('ERROR_PIPELINE_INVALID', { message: error.message }))
          })
          return
        }

        logger.error(t('ERROR_UPLOADING_PIPELINE', { file, message: err.message }))
        if (err.code === 'STEP_NOT_FOUND') logger.warn(t('CHECK_STEP_ATTACHED'))
      }
    }, 500)
  }

  async _startSubProcess () {
    const applicationId = await this.appSettings.getId()
    await this.backendProcess.connect()
    await this.backendProcess.selectApplication(applicationId)
    await this.backendProcess.resetHooks()
    await this.backendProcess.resetPipelines()
    await this._uploadPipelinesOfAttachedExtenstions()
    await this.pushHooks()
    await this.backendProcess.startStepExecutor()
    await this._attachAllExtensions()

    await utils.writeLocalPipelines(this.appSettings, this.dcHttpClient, applicationId, this.pipelinesFolder, this.trustedPipelinesFolder)
    await this.backendProcess.reloadPipelineController()
    logger.info(t('PIPELINES_DOWNLOADED'))

    // watcher
    await this.pipelineWatcher.start()
    await this.extensionConfigWatcher.start('backend')
    await this.attachedExtensionsWatcher.start()
    this.pipelineWatcher.on('all', (event, file) => this._pipelineEvent(event, file))

    this.extensionConfigWatcher.on('configChange', async (config) => {
      const valid = await extensionConfigChanged(config, this.appSettings, this.dcHttpClient, this.backendProcess)
      try {
        if (valid) await this.backendProcess.reloadPipelineController()
      } catch (err) {
        logger.error(t('ERROR_ACTIVATING_PIPELINES'))
      }
    })

    this.attachedExtensionsWatcher.on('attach', (extensionInfo) => this.backendProcess.attachExtension(extensionInfo))
    this.attachedExtensionsWatcher.on('detach', (extensionInfo) => this.backendProcess.detachExtension(extensionInfo))

    try {
      await this.cliProxy.start()
      await utils.setProcessFile('backend', this.settingsFolder, process.pid)
      logger.debug(t('BACKEND_READY'))
    } catch (err) {
      throw new Error(t('ERROR_COULD_NOT_START_CLI_PROXY', { err }))
    }
  }

  async _pipelineRemoved (file, trusted) {
    if (!this.pipelines[file] || !this.pipelines[file].id) return
    const pipelineId = this.pipelines[file].id
    logger.info(t('START_REMOVING_PIPELINE', { pipelineId }))

    const appId = await this.appSettings.getId()

    try {
      await this.dcHttpClient.removePipeline(pipelineId, appId, trusted)
      logger.info(t('REMOVED_PIPELINE', { pipelineId }))
      await utils.writeLocalPipelines(this.appSettings, this.dcHttpClient, appId, this.pipelinesFolder, this.trustedPipelinesFolder)
    } catch (err) {
      throw new Error(t('ERROR_COULD_NOT_REMOVE_PIPELINE', { pipelineId, message: err.message }))
    }
  }

  async _pipelineChanged (file, trusted) {
    const pipelineFileContent = await fsEx.readFile(file, 'utf8')
    let pipeline = jsonlint.parse(pipelineFileContent)

    if (!pipeline || !pipeline.pipeline || !pipeline.pipeline.id) throw new Error(t('ERROR_CHECK_INVALID_PIPELINE', { file }))

    const fileName = path.basename(file, '.json')
    if (fileName !== pipeline.pipeline.id) throw new Error(t('ERROR_PIPELINE_ID_SHOULD_MATCH_FILENAME', { pipelineId: pipeline.pipeline.id }))

    if (!this.pipelines[file]) this.pipelines[file] = {}
    this.pipelines[file].id = pipeline.pipeline.id

    const appId = await this.appSettings.getId()

    logger.debug(t('UPLOAD_PIPELINE'))
    await this.dcHttpClient.uploadPipeline(pipeline, appId, trusted)

    logger.debug(t('GET_UPDATED_PIPELINES'))
    await utils.writeLocalPipelines(this.appSettings, this.dcHttpClient, appId, this.pipelinesFolder, this.trustedPipelinesFolder)

    logger.debug(t('RELOAD_PIPELINES'))
    await this.backendProcess.reloadPipelineController()
    logger.info(t('UPDATED_PIPELINE', { file }))
  }

  async _attachAllExtensions () {
    const attachedExtensions = await this.appSettings.loadAttachedExtensions()
    const promises = []
    for (let extensionId in attachedExtensions) {
      attachedExtensions[extensionId].id = extensionId
      promises.push(this.backendProcess.attachExtension(attachedExtensions[extensionId]))
    }
    await Promise.all(promises)
  }

  async _uploadPipelinesOfAttachedExtenstions () {
    logger.info(t('START_SYNCING_PIPELINES'))
    const attachedExtensions = await this.appSettings.loadAttachedExtensions()
    const extensionsFolder = path.join(this.appSettings.getApplicationFolder(), EXTENSIONS_FOLDER)

    let pipelines = []
    let trustedPipelines = []
    for (let extensionId in attachedExtensions) {
      const extension = attachedExtensions[extensionId]

      // get list of pipelines of the extension
      const pipelineFolder = path.join(extensionsFolder, extension.path, 'pipelines')

      let pipelinesFiles = []
      try {
        pipelinesFiles = await fsEx.readdir(pipelineFolder)
      } catch (e) {
        logger.debug(t('SKIPPING_PIPELINE_UPLOAD', { extensionId, reason: t('ERROR_NO_PIPELINES_DIRECTORY') }))
        continue
      }

      pipelinesFiles = pipelinesFiles.filter((pipelineFile) => { return pipelineFile.endsWith('.json') && !pipelineFile.startsWith('.') })
      const promises = []

      if (pipelinesFiles < 1) {
        logger.debug(t('SKIPPING_PIPELINE_UPLOAD', { extensionId, reason: t('ERROR_NO_PIPELINES') }))
        continue
      }

      // read pipelines
      for (let index in pipelinesFiles) promises.push(fsEx.readJSON(path.join(pipelineFolder, pipelinesFiles[index])))

      // once loaded, validate pipeline IDs vs pipeline file names; should be the same for each
      const loadedPipelines = await Promise.all(promises)
      let pipelineFileNameMismatches = []
      loadedPipelines.forEach((pipeline, index) => {
        if (pipeline.pipeline.id !== path.basename(pipelinesFiles[index], '.json')) {
          pipelineFileNameMismatches.push(t('ERROR_PIPELINE_ID_AND_FILENAME_MISMATCH', {
            pipelineId: pipeline.pipeline.id,
            filename: path.basename(pipelinesFiles[index], '.json')
          }))
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

    const appId = await this.appSettings.getId()

    await Promise.all([
      this.dcHttpClient.uploadMultiplePipelines(pipelines, appId, false),
      this.dcHttpClient.uploadMultiplePipelines(trustedPipelines, appId, true)
    ])
    logger.info(t('ALL_PIPELINES_SYNCED'))
  }
}

module.exports = BackendAction
