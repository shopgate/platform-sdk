const path = require('path')
const logger = require('../logger')
const { generateComponentsJson, updateExtensionConfig, validateExtensionConfig, pushHooks, writeLocalPipelines } = require('./utils')
const { PIPELINES_FOLDER, TRUSTED_PIPELINES_FOLDER } = require('../app/Constants')
const t = require('../i18n')(__filename)

module.exports = {
  /**
   * @param {Internal.ExtensionConfig} config
   * @param {Internal.AppSettings} appSettings
   * @param {Internal.DcHttpClient} dcHttpClient
   */
  extensionConfigChanged: async (config, appSettings, dcHttpClient) => {
    const appId = await appSettings.getId()

    try {
      await validateExtensionConfig(config)
    } catch (err) {
      logger.error(t('ERROR_VALIDATION', { fileId: config.file.id, message: err.message }))
      return false
    }

    try {
      await updateExtensionConfig(config, appId, dcHttpClient)
      await generateComponentsJson(appSettings)
    } catch (err) {
      logger.error(t('ERROR_GENERATE', { fileId: config.file.id, message: err.message }))
      logger.debug(err)
    }

    try {
      await pushHooks(appSettings, dcHttpClient)

      const pipelinesFolder = path.join(appSettings.getApplicationFolder(), PIPELINES_FOLDER)
      const trustedPipelinesFolder = path.join(appSettings.getApplicationFolder(), TRUSTED_PIPELINES_FOLDER)
      await writeLocalPipelines(appSettings, dcHttpClient, appId, pipelinesFolder, trustedPipelinesFolder)
    } catch (err) {
      logger.error(t('ERROR_UPDATE_HOOKS', { fileId: config.file.id, message: err.message }))
      logger.debug(err)
    }

    return true
  }
}
