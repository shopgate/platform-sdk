const logger = require('../logger')
const { generateComponentsJson, updateExtensionConfig, validateExtensionConfig, pushHooks, writeLocalPipelines } = require('./utils')
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
      logger.error(new Error(`Could not validate config for '${config.file.id}': ${err.message}`))
      return logger.debug(err)
    }

    try {
      await updateExtensionConfig(config, appId, dcHttpClient)
      await generateComponentsJson(appSettings)
    } catch (err) {
      logger.error(new Error(`Could not generate config for '${config.file.id}': ${err.message}`))
      logger.debug(err)
    }

    try {
      await pushHooks(appSettings, dcHttpClient)
      await writeLocalPipelines(dcHttpClient, appId)
    } catch (err) {
      logger.error(new Error(`Could not update hooks triggered by change of '${config.file.id}': ${err.message}`))
      logger.debug(err)
    }
  }
}
