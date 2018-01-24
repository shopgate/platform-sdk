/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
const fsEx = require('fs-extra')
const async = require('neo-async')
const path = require('path')
const inquirer = require('inquirer')
const request = require('request')
const unzip = require('unzip')
const logger = require('../logger')
const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const FrontendProcess = require('../app/frontend/FrontendProcess')
const FrontendSetup = require('../app/frontend/FrontendSetup')
const DcHttpClient = require('../DcHttpClient')
const utils = require('../utils/utils')

/**
 * The FrontendAction class.
 */
class FrontendAction {
  constructor () {
    this.appSettings = new AppSettings().validate()
    this.userSettings = new UserSettings().validate()
    this.settingsFolder = path.join(this.appSettings.getApplicationFolder(), AppSettings.SETTINGS_FOLDER)
    this.dcClient = new DcHttpClient(this.userSettings)
    this.frontendSetup = new FrontendSetup(this.dcClient, this.appSettings)
  }

  /**
   * Registers the frontend command.
   * @param {Command} caporal Instance of the commander module.
   */
  static register (caporal) {
    caporal
      .command('frontend start')
      .description('Starts the webpack dev server for the frontend development')
      .option('-t, --theme [value]', 'The name of the theme that you want to be compiled by webpack.')
      .option('-h, --host [value]', 'The URL or IP address of your local development environment.')
      .option('-p, --port [value]', 'The port to use for accessing the output via browser.')
      .action((args, options) => new FrontendAction().run('start', args, options))

    caporal
      .command('frontend setup')
      .description('Changes the settings for the frontend development')
      .action((args, options) => new FrontendAction().run('setup', args, options))
  }

  /**
   * Find all themes inside the project.
   * @returns {Array}
   */
  async _findThemes () {
    // Absolute path to the themes.
    const source = path.resolve(this.appSettings.getApplicationFolder(), AppSettings.THEMES_FOLDER)

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
  _requestThemeOption () {
    return new Promise(async (resolve, reject) => {
      const themes = await this._findThemes()

      if (!themes.length) {
        logger.error('You don\'t have any theme installed!')

        return this._installTheme()
          .then(theme => resolve(theme))
          .catch(error => reject(error))
      }

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

  _installTheme () {
    return this._inquireInstall()
      .then(answers => this._inquireTheme(answers.confirmed))
      .then(answers => this._downloadTheme(answers.theme))
  }

  _inquireInstall () {
    return inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message: 'Would you like to install from one of our pre-made themes?',
      default: true
    }])
  }

  _inquireTheme (confirmed) {
    if (!confirmed) return process.exit(0)
    return inquirer.prompt([{
      type: 'list',
      name: 'theme',
      message: 'Please choose a theme to install:',
      choices: ['theme-gmd', 'theme-ios']
    }])
  }

  _downloadTheme (theme) {
    logger.debug(`Downloading theme '${theme}' ...`)

    return new Promise((resolve, reject) => {
      const themesFolder = path.resolve(this.appSettings.getApplicationFolder(), AppSettings.THEMES_FOLDER)
      const extractor = unzip.Extract({ path: themesFolder })

      extractor.on('close', () => {
        logger.debug(`Downloading theme '${theme}' ...`)
        resolve()
      })

      extractor.on('error', (err) => {
        if (process.env['LOG_LEVEL'] === 'debug') logger.error(err)
        reject(new Error(`Error while downloading theme '${theme}': ${err.message}`))
      })

      const url = `https://github.com/shopgate/${theme}/archive/master.zip`
      request(url).pipe(extractor)
    })
  }

  /**
   * Runs the frontend process.
   * @param {string} action The action to perform.
   * @param {Object} [args={}] The process args.
   * @param {Object} [options={}] The process options.
   */
  async run (action, args, options = {}) {
    this.userSettings = new UserSettings().validate()
    this.appSettings = new AppSettings().validate()

    const pid = utils.previousProcess('frontend', this.settingsFolder)
    if (pid) throw new Error(`Frontend process is already running with pid: ${pid}. Please quit this process first.`)

    switch (action) {
      default:
      case 'start': {
        if (options.theme) return this._start(options, await this._buildThemePath(options.theme))

        return this._requestThemeOption()
          .then(async (theme) => this._start({ ...options, theme }, await this._buildThemePath(theme)))
          .catch((error) => {
            console.error(error)
            process.exit(1)
          })
      }
      case 'setup': {
        this._setup()
        break
      }
    }

    process.on('SIGINT', () => {
      utils.deleteProcessFile('frontend', this.settingsFolder)
    })
  }

  /**
   * Builds the theme folder path.
   * @param {string} theme The theme folder.
   * @return {string}
   */
  async _buildThemePath (theme) {
    const themePath = path.join(this.appSettings.getApplicationFolder(), AppSettings.THEMES_FOLDER, theme)
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
  async _start (options, themeFolder) {
    const frontend = new FrontendProcess(options, this.frontendSetup, this.appSettings)

    await this._updateThemeConfig(themeFolder)
      .then(() => frontend.run())
      .then(() => utils.setProcessFile('frontend', this.settingsFolder, process.pid))
      .catch(error => {
        console.error(error)
        process.exit(1)
      })
  }

  _setup () {
    this.frontendSetup
      .run()
      .catch(error => {
        console.error(error)
        process.exit(1)
      })
  }

  async _updateThemeConfig (templateFolder) {
    logger.info('Generating theme config')
    const extensionConfigFile = await fsEx.readJSON(path.join(templateFolder, 'extension-config.json'))

    return new Promise((resolve, reject) => {
      async.retry({
        times: 5,
        interval: (count) => 100 * Math.pow(2, count)
      }, (acb) => {
        this.dcClient.generateExtensionConfig(extensionConfigFile, this.appSettings.getId(), (err, extConfig) => {
          if (err) return acb(new Error(`Could not generate config: ${err.message}`))
          return acb(null, extConfig)
        })
      }, (err, extConfig) => {
        if (err) return reject(err)
        if (!extConfig.frontend) {
          logger.warn('No config with the destination \'frontend\' found')
          return resolve()
        }

        const appJsonFile = path.join(templateFolder, 'config', 'app.json')
        fsEx.outputJsonSync(appJsonFile, extConfig.frontend, {spaces: 2})
        logger.info('Updated theme config')
        resolve()
      })
    })
  }
}

module.exports = FrontendAction
