const fsEx = require('fs-extra')
const path = require('path')
const logger = require('../logger')
const { generateComponentsJson } = require('./utils')
module.exports = {
  /**
   * @param {Internal.ExtensionConfig} config
   */
  extensionConfigChanged: async (config, appSettings, dcHttpClient) => {
    try {
      const extConfig = await dcHttpClient.generateExtensionConfig(config.file, await appSettings.getId())
      const backendConfig = extConfig.backend || {}
      const backendPath = path.join(config.path, 'extension', 'config.json')
      if (backendPath) {
        await fsEx.outputJson(backendPath, backendConfig, { spaces: 2 })
        logger.info(`Updated extension config for backend ${config.file.id}`)
      }
      generateComponentsJson(appSettings)
    } catch (err) {
      logger.error(new Error(`Could not generate config for '${config.file.id}': ${err.message}`))
      logger.debug(err)
    }
  }
}
