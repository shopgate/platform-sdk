const UserSettings = require('../user/UserSettings')
const DcHttpClient = require('../DcHttpClient')
const UnauthorizedError = require('../errors/UnauthorizedError')
const AppSettings = require('../app/AppSettings')
const logger = require('../logger')
const { SETTINGS_FOLDER, EXTENSIONS_FOLDER, PIPELINES_FOLDER, TRUSTED_PIPELINES_FOLDER, THEMES_FOLDER } = require('../app/AppSettings')
const inquirer = require('inquirer')
const path = require('path')
const fsEx = require('fs-extra')
const utils = require('../utils/utils')

const FOLDERS = [SETTINGS_FOLDER, EXTENSIONS_FOLDER, PIPELINES_FOLDER, TRUSTED_PIPELINES_FOLDER, THEMES_FOLDER]

class InitAction {
  /**
   * @param {Command} caporal
   * @param {AppSettings} appSettings
   */
  static register (caporal, appSettings) {
    caporal
      .command('init')
      .description('Init the sdk')
      .option('--appId <appId>', 'set the Sandbox App ID you want to initialize')
      .action((args, options) => new InitAction(appSettings).run(options, (err, appId, aborted) => {
        if (err) return logger.error(err.message)
        if (aborted) return logger.info('Init was aborted by user')
        logger.info(`The Application "${appId}" was successfully initialized`)
      }))
  }

  /**
   * @param {AppSettings} appSettings
   */
  constructor (appSettings) {
    this.appSettings = appSettings
  }

  /**
   * @param {object} options
   * @param {function} [cb]
   */
  async run (options, cb) {
    this.options = options
    const userSettings = new UserSettings().validate()

    let appSettingsExists = true
    try {
      await this.appSettings.validate()
    } catch (err) {
      appSettingsExists = false
      logger.debug('App settings are not present')
    }

    if (appSettingsExists) {
      return this.checkForRunningProcesses(inquirer.prompt, async (err, stopInit) => {
        if (err) return cb(err)
        if (stopInit) return cb(null, null, true)

        return this.permitDeletion(inquirer.prompt, await this.appSettings.getId(), async (err, overwrite) => {
          if (err) return cb(err)
          if (!overwrite) return cb(null, null, true)
          await this.getAppId(inquirer.prompt, async (err, appId) => {
            if (err) return cb(err)
            await this.initApplication(appId, userSettings, true, cb)
          })
        })
      })
    }

    return this.getAppId(inquirer.prompt, async (err, appId) => {
      if (err) return cb(err)
      if (!appId) return cb(new Error('Sandbox App ID (--appId) is invalid'))

      FOLDERS.forEach(folder => {
        if (process.env.APP_PATH) folder = path.join(process.env.APP_PATH, folder)
        fsEx.ensureDir(folder)
      })

      await this.initApplication(appId, userSettings, false, cb)
    })
  }

  /**
   * @param {Prompt} prompt
   * @param {function} cb
   */
  async getAppId (prompt, cb) {
    if (this.options.appId) return cb(null, this.options.appId)
    prompt([{type: 'input', name: 'appId', message: 'Enter your Sandbox App ID:'}]).then(answers => cb(null, answers.appId))
  }

  /**
   * @param {Prompt} prompt
   * @param {String} appId
   * @param {function} cb
   */
  async permitDeletion (prompt, appId, cb) {
    const contentToBeDeleted = [
      ' - project related settings',
      ' - generated extension/theme config files',
      ' - active (trusted) pipelines'
    ].join('\n')

    logger.info(`The application ${appId} is currently initialized.\n\nReinit will delete the following project content:\n${contentToBeDeleted}`)
    prompt({type: 'input', name: 'overwrite', default: 'n', message: `Do you really want to overwrite your current application (${appId})? (y/N)`}).then(answers => {
      return cb(null, answers.overwrite.charAt(0).toLowerCase() === 'y')
    })
  }

  /**
   * @param {Prompt} prompt
   * @param {function} cb
   */
  async checkForRunningProcesses (prompt, cb) {
    const processes = []
    if (await utils.previousProcess('backend', AppSettings.SETTINGS_FOLDER)) processes.push('backend')
    if (await utils.previousProcess('frontend', AppSettings.SETTINGS_FOLDER)) processes.push('frontend')

    if (processes.length > 0) {
      return prompt({type: 'input', name: 'ignore', default: 'n', message: `Processe(s): ${processes.join(', ')} running, reinit can cause problems in these processes; ignore? (y,N)`}).then(answers => {
        return cb(null, answers.ignore.charAt(0).toLowerCase() === 'n')
      })
    }

    return cb(null, false)
  }

  /**
   * @param {String} appId
   * @param {UserSettings} userSettings
   * @param {bool} reset
   * @param {function} cb
   */
  async initApplication (appId, userSettings, reset, cb) {
    new DcHttpClient(userSettings).getApplicationData(appId, async (err) => {
      if (err) {
        logger.debug(err)
        if (err instanceof UnauthorizedError) return cb(new Error('You\'re not logged in! Please run `sgcloud login` again.'))
        if (cb) return cb(new Error(`The application ${appId} is not available or permissions are missing (message: ${err.message}). Please check the application at developer.shopgate.com!`))
      }
      if (reset) await utils.resetProject()
      await this.appSettings.setId(appId)
      await cb(null, appId, false)
    })
  }
}

module.exports = InitAction
