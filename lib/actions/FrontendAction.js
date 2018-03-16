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

const { SETTINGS_FOLDER, THEMES_FOLDER } = require('../app/Constants')

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
      .description('Starts the webpack dev server for the frontend development')
      .option('-t, --theme [value]', 'The name of the theme that you want to be compiled by webpack.')
      .option('-h, --host [value]', 'The URL or IP address of your local development environment.')
      .option('-p, --port [value]', 'The port to use for accessing the output via browser.')
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
      .description('Changes the settings for the frontend development')
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
   * Find all themes inside the project.
   * @returns {Array}
   */
  async findThemes () {
    // Absolute path to the themes.
    const source = path.resolve(this.appSettings.getApplicationFolder(), THEMES_FOLDER)

    // Get all folders inside the themes directory.
    const folders = await fsEx.readdir(source)

    const promises = folders.map(folder => fsEx.lstat(path.join(source, folder)))
    const results = await Promise.all(promises)

    return folders.filter((folder, index) => results[index].isDirectory())
  }

  /**
   * Inquires a theme selection if not theme was set as an option.
   * @return {Promise}
   */
  requestThemeOption () {
    return new Promise(async (resolve, reject) => {
      const themes = await this.findThemes()
      if (themes.length === 1) return resolve(themes[0])

      inquirer
        .prompt([{
          type: 'list',
          name: 'theme',
          message: 'Please choose a theme to use',
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

    const pid = await utils.previousProcess('frontend', this.settingsFolder)
    if (pid) throw new Error(`Frontend process is already running with pid: ${pid}. Please quit this process first.`)

    switch (action) {
      default:
      case 'start': {
        await utils.generateComponentsJson(this.appSettings)
        let theme = options.theme
        if (!theme) theme = await this.requestThemeOption()
        await this.start({ ...options, theme }, await this.buildThemePath(theme))
        break
      }
      case 'setup': {
        let showMessage = true
        if (process.env.INTEGRATION_TEST === 'true') showMessage = false
        await this.frontendSetup.run(showMessage)
        break
      }
    }

    process.on('SIGINT', async () => {
      await this.extensionConfigWatcher.stop()
      await utils.deleteProcessFile('frontend', this.settingsFolder)
    })
  }

  /**
   * Builds the theme folder path.
   * @param {string} theme The theme folder.
   * @return {string}
   */
  async buildThemePath (theme) {
    const themePath = path.join(this.appSettings.getApplicationFolder(), THEMES_FOLDER, theme)
    if (!await fsEx.exists(themePath)) {
      throw new Error(`Can't find theme '${theme}'. Please make sure you passed the right theme.`)
    }
    return themePath
  }

  /**
   * Runs the 'start' command.
   * @param {Object} options The process options.
   * @param {string} themeFolder The theme folder.
   */
  async start (options, themeFolder) {
    const frontend = new FrontendProcess(options, this.frontendSetup, this.appSettings)

    await this.extensionConfigWatcher.start()
    this.extensionConfigWatcher.on('configChange', async () => {
      // Create components.json if needed
      await utils.generateComponentsJson(this.appSettings)
    })

    await this.updateThemeConfig(themeFolder)
    await frontend.run()
    await utils.setProcessFile('frontend', this.settingsFolder, process.pid)
  }

  async updateThemeConfig (templateFolder) {
    logger.info(`Generating theme config`)
    const extensionConfigFile = await fsEx.readJSON(path.join(templateFolder, 'extension-config.json'))

    return this.dcHttpClient.generateExtensionConfig(extensionConfigFile, await this.appSettings.getId())
      .then((extConfig) => {
        if (!extConfig.frontend) return logger.warn('No config with the destination \'frontend\' found')
        const appJsonFile = path.join(templateFolder, 'config', 'app.json')
        return fsEx.outputJson(appJsonFile, extConfig.frontend, { spaces: 2 })
      })
      .then(() => {
        logger.info(`Updated theme config`)
      })
      .catch(err => {
        throw new Error('Could not generate config: ' + err.message)
      })
  }
}

module.exports = FrontendAction
