/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
const fsEx = require('fs-extra')
const path = require('path')
const inquirer = require('inquirer')
const logger = require('../logger')
const FrontendProcess = require('../app/frontend/FrontendProcess')
const FrontendSetup = require('../app/frontend/FrontendSetup')
const utils = require('../utils/utils')
const ExtensionConfigWatcher = require('../app/ExtensionConfigWatcher')
const { extensionConfigChanged } = require('../utils/EventHandler')
const { SETTINGS_FOLDER, THEMES_FOLDER } = require('../app/Constants')
const t = require('../i18n')(__filename)

/**
 * The FrontendAction class.
 */
class FrontendAction {
  /**
   * @param {AppSettings} appSettings
   * @param {UserSettings} userSettings
   * @param {DcHttpClient} dcHttpClient
   */
  constructor (appSettings, userSettings, dcHttpClient) {
    this.appSettings = appSettings
    this.userSettings = userSettings
    this.settingsFolder = path.join(this.appSettings.getApplicationFolder(), SETTINGS_FOLDER)
    this.dcHttpClient = dcHttpClient
    this.frontendSetup = new FrontendSetup(this.dcHttpClient, this.appSettings)
    this.extensionConfigWatcher = new ExtensionConfigWatcher(this.appSettings)
  }

  /**
   * Registers the frontend command.
   * @param {Command} caporal Instance of the commander module.
   * @param {AppSettings} appSettings
   * @param {UserSettings} userSettings
   * @param {DcHttpClient} dcHttpClient
   */
  static register (caporal, appSettings, userSettings, dcHttpClient) {
    caporal
      .command('frontend start')
      .description(t('START_DESCRIPTION'))
      .option('-t, --theme [value]', t('START_THEME_DESCRIPTION'))
      .option('-h, --host [value]', t('START_HOST_DESCRIPTION'))
      .option('-p, --port [value]', t('START_PORT_DESCRIPTION'))
      .option('-a, --analyze', t('START_ANALYZE_DESCRIPTION'))
      .action(async (args, options) => {
        try {
          await new FrontendAction(appSettings, userSettings, dcHttpClient).run('start', args, options)
        } catch (err) {
          // istanbul ignore next
          logger.error(err.message)
          process.exit(1)
        }
      })

    caporal
      .command('frontend setup')
      .description(t('SETUP_DESCRIPTION'))
      .action(async (args, options) => {
        try {
          await new FrontendAction(appSettings, userSettings, dcHttpClient).run('setup', args, options)
        } catch (err) /* istanbul ignore next */ {
          logger.error(err.message)
          process.exit(1)
        }
      })
  }

  /**
   * Inquires a theme selection if not theme was set as an option.
   * @return {Promise}
   */
  requestThemeOption () {
    return new Promise(async (resolve, reject) => {
      const themes = await utils.findThemes(this.appSettings)
      if (themes.length === 1) return resolve(themes[0])

      inquirer
        .prompt([{
          type: 'list',
          name: 'theme',
          message: t('INPUT_CHOOSE_THEME'),
          choices: themes
        }])
        .then(answers => resolve(answers.theme))
        .catch(error => reject(error))
    })
  }

  /**
   * Runs the frontend process.
   * @param {string} action The action to perform.
   * @param {Object} [args={}] The process args.
   * @param {Object} [options={}] The process options.
   */
  async run (action, args, options = {}) {
    await this.userSettings.validate()
    await this.appSettings.validate()

    const pid = await utils.getProcessId('frontend', this.settingsFolder)
    if (pid) throw new Error(t('ERROR_FRONTENT_ALREADY_RUNNING', { pid }))

    switch (action) {
      default:
      case 'start': {
        await this.dcHttpClient.checkPermissions(await this.appSettings.getId())
        await utils.generateComponentsJson(this.appSettings)
        await utils.writeExtensionConfigs(this.appSettings, this.dcHttpClient)

        let theme = options.theme
        if (!theme) theme = await this.requestThemeOption()
        const frontendSettings = this.appSettings.getFrontendSettings()

        if (!await frontendSettings.getStartpageIpAddress()) {
          await frontendSettings.setStartpageIpAddress()
        }

        await this.setStartPage(
          await this.appSettings.getId(),
          await frontendSettings.getStartpageIpAddress(),
          await frontendSettings.getPort()
        )
        await this.start({ ...options, theme }, await this.buildThemePath(theme))
        break
      }
      case 'setup': {
        const showMessage = process.env.INTEGRATION_TEST !== 'true'
        await this.frontendSetup.run(showMessage)
        break
      }
    }
  }

  /**
   * Builds the theme folder path.
   * @param {string} theme The theme folder.
   * @return {string}
   */
  async buildThemePath (theme) {
    const themePath = path.join(this.appSettings.getApplicationFolder(), THEMES_FOLDER, theme)
    if (!await fsEx.exists(themePath)) {
      throw new Error(t('ERROR_THEME_NOT_FOUND', { theme }))
    }
    return themePath
  }

  /**
   * @param {string} appId
   * @param {string} address
   * @param {number} port
   */
  async setStartPage (appId, address, port) {
    await this.dcHttpClient.setStartPageUrl(appId, `http://${address}:${port}`)
  }

  /**
   * @param {string} appId
   */
  async resetStartPage (appId) {
    await this.dcHttpClient.setStartPageUrl(appId, '')
  }

  /**
   * Runs the 'start' command.
   * @param {Object} options The process options.
   * @param {string} themeFolder The theme folder.
   */
  async start (options, themeFolder) {
    const frontend = new FrontendProcess(options, this.frontendSetup, this.appSettings)

    process.on('SIGINT', async () => {
      try {
        frontend.stop()
        await this.extensionConfigWatcher.stop()
        await utils.deleteProcessFile('frontend', this.settingsFolder)
        await this.resetStartPage(await this.appSettings.getId())
        process.exit(0)
      } catch (err) {
        logger.error(err.message)
        process.exit(err.code)
      }
    })

    await this.extensionConfigWatcher.start('frontend')
    this.extensionConfigWatcher.on('configChange', (config) => extensionConfigChanged(config, this.appSettings, this.dcHttpClient))
    await this.updateThemeConfig(themeFolder)
    await frontend.run()
    await utils.setProcessFile('frontend', this.settingsFolder, process.pid)
  }

  async updateThemeConfig (templateFolder) {
    logger.info(t('GENERATING_THEME_CONFIG'))
    const extensionConfigFile = await fsEx.readJSON(path.join(templateFolder, 'extension-config.json'))

    return this.dcHttpClient.generateExtensionConfig(extensionConfigFile, await this.appSettings.getId())
      .then((extConfig) => {
        if (!extConfig.frontend) return logger.warn(t('ERROR_NO_FRONTEND_CONFIG'))
        const appJsonFile = path.join(templateFolder, 'config', 'app.json')
        return fsEx.outputJson(appJsonFile, extConfig.frontend, { spaces: 2 })
      })
      .then(() => {
        logger.info(t('UPDATED_THEME_CONFIG'))
      })
      .catch(err => {
        throw new Error(t('ERROR_COULD_NOT_GENERATE_CONFIG_REASON', { reason: err.message }))
      })
  }
}

module.exports = FrontendAction
