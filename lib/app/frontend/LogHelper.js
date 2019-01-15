/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { cyan, green, blue, red, bold } = require('chalk')
const logger = require('../../logger')
const t = require('../../i18n')(__filename)

/**
 * The Logger class hold static functions for logging useful information when running
 * the Rapid Dev Server and the Webpack Dev Server.
 * @type {LogHelper}
 */
class LogHelper {
  constructor () {
    /**
     * A divider for console outputs.
     * @type {string}
     */
    this.divider = '---------------------------------------------------------------------------\n'
    /**
     * A colored Shopgate Cloud prefix for console outputs.
     * @type {string}
     */
    this.prefix = `${green('Shopgate')}${blue('Connect')}`
  }

  /**
   * Returns the divider.
   * @return {string}
   */
  getDivider () {
    return this.divider
  }

  /**
   * Returns the Shopgate Cloud prefix
   * @return {string}
   */
  getPrefix () {
    return this.prefix
  }

  /**
   * Logs if silent mode is active and logs will be suppressed.
   */
  logSilentMode () {
    // Only log if silent mode is active.
    if (process.env.silent) {
      logger.plain(`  ${bold(t('SILENT_MODE'))}\n`)
    }
  }

  logHeader (title) {
    logger.plain(`\n\n${this.getDivider()}`)
    logger.plain(`  ${green('S H O P G A T E')}   ${blue('C O N N E C T')}`)
    logger.plain(`  ${title}\n`)
    logger.plain(this.getDivider())
  }

  /**
   * Logs the server logo.
   */
  logLogo () {
    this.logHeader('D E V E L O P M E N T   S E R V E R')
    this.logSilentMode()
  }

  /**
   * Logs the setup logo.
   */
  logSetupLogo () {
    this.logHeader('F R O N T E N D   S E T U P')
    logger.plain(t('SETUP_PROCESS_INTRO'))
    logger.plain(`${t('PLEASE_ANSWER_QUESTIONS')}:\n`)
  }

  /**
   * Logs if the setup is needed.
   */
  logSetupNeeded () {
    logger.plain(`\n${this.getDivider()}`)
    logger.plain(`  ${red(bold(t('ATTENTION')))}: ${t('NO_FRONTEND_CONFIG')}`)
    logger.plain(`  ${t('NO_FRONTEND_CONFIG_FOLLOWUP', { prefix: this.getPrefix() })}\n`)
    logger.plain(this.getDivider())
    logger.plain(`${t('PLEASE_ANSWER_QUESTIONS')}:\n`)
  }

  /**
   * Logs the Rapid Dev Server startup information.
   */
  logStartUp () {
    logger.plain(`  ${t('DEV_SERVER_STARTED')}:\n`)
    logger.plain(`     ${cyan(`http://${process.env.ip}:${process.env.port}`)}\n`)
    logger.plain(`  ${t('PRESS_TO_STOP', { key: cyan.bold('CTRL-C') })}\n`)
    logger.plain(this.getDivider())
  }

  logExit () {
    this.logHeader(`${t('DEV_SERVER_STOPPED')}\n  ${t('SEE_YOU_SOON')}`)
  }
}

module.exports = new LogHelper()
