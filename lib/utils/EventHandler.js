const logger = require('../logger')
const { generateComponentsJson, updateExtensionConfig, validateExtensionConfig } = require('./utils')
module.exports = {
  /**
   * @param {Internal.ExtensionConfig} config
   * @param {Internal.AppSettings} appSettings
   * @param {Internal.DcHttpClient} dcHttpClient
   */
  extensionConfigChanged: async (config, appSettings, dcHttpClient) => {
    try {
      await validateExtensionConfig(config)
      await updateExtensionConfig(config, await appSettings.getId(), dcHttpClient)
      await generateComponentsJson(appSettings)
    } catch (err) {
      logger.error(new Error(`Could not generate config for '${config.file.id}': ${err.message}`))
      logger.debug(err)
    }
  }
}
