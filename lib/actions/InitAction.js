const { UnauthorizedError } = require('../errors')
const logger = require('../logger')
const { SETTINGS_FOLDER, EXTENSIONS_FOLDER, PIPELINES_FOLDER, TRUSTED_PIPELINES_FOLDER, THEMES_FOLDER } = require('../app/Constants')
const inquirer = require('inquirer')
const path = require('path')
const fsEx = require('fs-extra')
const utils = require('../utils/utils')

const FOLDERS = [SETTINGS_FOLDER, EXTENSIONS_FOLDER, PIPELINES_FOLDER, TRUSTED_PIPELINES_FOLDER, THEMES_FOLDER]

class InitAction {
  /**
   * @param {Command} caporal
   * @param {AppSettings} appSettings
   * @param {UserSettings} userSettings
   * @param {DcHttpClient} dcHttpClient
   */
  static register (caporal, appSettings, userSettings, dcHttpClient) {
    caporal
      .command('init')
      .description('Init the sdk')
      .option('--appId <appId>', 'set the Sandbox App ID you want to initialize')
      .option('--force', 'won\'t ask for permission for overwriting previously set application')
      .action(async (args, options) => {
        try {
          // istanbul ignore next
          const appId = await new InitAction(appSettings, userSettings, dcHttpClient).run(options)
          if (!appId) return logger.info('Init was aborted by user')
          logger.info(`The Application "${appId}" was successfully initialized`)
        } catch (err) /* istanbul ignore next */ {
          logger.error(err.message)
          process.exit(1)
        }
      })
  }

  /**
   * @param {AppSettings} appSettings
   * @param {UserSettings} userSettings
   * @param {DcHttpClient} dcHttpClient
   */
  constructor (appSettings, userSettings, dcHttpClient) {
    this.appSettings = appSettings
    this.userSettings = userSettings
    this.dcHttpClient = dcHttpClient
  }

  /**
   * @param {object} options
   * @return {string|boolean} The app ID or boolean false if the action was aborted.
   * @throws {Error} if initialization fails.
   */
  async run (options) {
    this.options = options
    let appSettingsExists = true

    // may throw an error if the user is not logged in
    await this.userSettings.validate()

    try {
      await this.appSettings.validate()
    } catch (err) {
      appSettingsExists = false
      logger.debug('App settings are not present')
    }

    if (appSettingsExists) {
      if (!this.options.force) {
        const ignoreRunningProcesses = await this.checkForRunningProcesses(inquirer.prompt)
        if (!ignoreRunningProcesses) return false

        const ignoreAlreadyInitialized = await this.permitDeletion(inquirer.prompt, await this.appSettings.getId())
        if (!ignoreAlreadyInitialized) return false
      }

      const appId = await this.getAppId(inquirer.prompt)
      return this.initApplication(appId, this.userSettings, true)
    }

    const appId = await this.getAppId(inquirer.prompt)
    if (!appId) throw new Error('Sandbox App ID (--appId) is invalid')

    await Promise.all(FOLDERS.map(folder => {
      if (process.env.APP_PATH) folder = path.join(process.env.APP_PATH, folder)
      return fsEx.ensureDir(folder)
    }))

    return this.initApplication(appId, this.userSettings, false)
  }

  /**
   * @param {Prompt} prompt
   * @return {string} The app ID.
   */
  async getAppId (prompt) {
    if (this.options.appId) return this.options.appId

    const answers = await prompt([{
      type: 'input',
      name: 'appId',
      message: 'Enter your Sandbox App ID:'
    }])

    return answers.appId
  }

  /**
   * @param {Prompt} prompt
   * @param {String} appId
   * @return {boolean} True if already initialized project should be re-initialized, false otherwise.
   */
  async permitDeletion (prompt, appId) {
    const contentToBeDeleted = [
      ' - project related settings',
      ' - generated extension/theme config files',
      ' - active (trusted) pipelines'
    ].join('\n')

    logger.info(`The application ${appId} is currently initialized.\n\nReinit will delete the following project content:\n${contentToBeDeleted}`)
    const answers = await prompt({
      type: 'input',
      name: 'overwrite',
      default: 'n',
      message: `Do you really want to overwrite your current application (${appId})? (y/N)`
    })

    return answers.overwrite.charAt(0).toLowerCase() === 'y'
  }

  /**
   * @param {Prompt} prompt
   * @return {boolean} True if no processes running or reinit should be done anyway, false otherwise.
   */
  async checkForRunningProcesses (prompt) {
    const processes = []
    if (await utils.getProcessId('backend', SETTINGS_FOLDER)) processes.push('backend')
    if (await utils.getProcessId('frontend', SETTINGS_FOLDER)) processes.push('frontend')

    if (processes.length > 0) {
      const answers = await prompt({
        type: 'input',
        name: 'ignore',
        default: 'n',
        message: `Processe(s): ${processes.join(', ')} running, reinit can cause problems in these processes; ignore? (y,N)`
      })

      return answers.ignore.charAt(0).toLowerCase() === 'y'
    }

    return true
  }

  /**
   * @param {String} appId
   * @param {UserSettings} userSettings
   * @param {boolean} reset
   * @return {string} The app ID.
   */
  async initApplication (appId, userSettings, reset) {
    try {
      await this.dcHttpClient.getApplicationData(appId)
      if (reset) await utils.resetProject()
      await this.appSettings.setId(appId)
      const frontendSettings = this.appSettings.getFrontendSettings()
      await frontendSettings.setIpAddress()
      await frontendSettings.setStartpageIpAddress()
      await frontendSettings.setPort()
      await frontendSettings.setApiPort()
      await frontendSettings.setHmrPort()
      await frontendSettings.setRemotePort()
      await frontendSettings.setSourceMapsType()

      return appId
    } catch (err) {
      logger.debug(err)
      if (err instanceof UnauthorizedError) throw new Error('You\'re not logged in! Please run `sgconnect login` again.')
      throw new Error(`The application ${appId} is not available or permissions are missing (message: ${err.message}). Please check the application at developer.shopgate.com!`)
    }
  }
}

module.exports = InitAction
