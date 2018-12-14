/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { cyan, green, blue, red, bold } = require('chalk')
const logger = require('../../logger')

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
    this.prefix = `${green('Shopgate')}${blue('Cloud')}`
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
      logger.plain(bold('  SILENT MODE: logs will be suppressed.\n'))
    }
  }

  /**
   * Logs the server logo.
   */
  logLogo () {
    logger.plain(`\n\n${this.getDivider()}`)
    logger.plain(`  ${green('S H O P G A T E')}   ${blue('C L O U D')}`)
    logger.plain('  D E V E L O P M E N T   S E R V E R\n')
    logger.plain(this.getDivider())
    this.logSilentMode()
  }

  /**
   * Logs the setup logo.
   */
  logSetupLogo () {
    logger.plain(`\n${this.getDivider()}`)
    logger.plain(`  ${green('S H O P G A T E')}   ${blue('C L O U D')}`)
    logger.plain('  F R O N T E N D   S E T U P\n')
    logger.plain(this.getDivider())
    logger.plain('This will guide you through the setup process.')
    logger.plain('Please answer the following questions:\n')
  }

  /**
   * Logs if the setup is needed.
   */
  logSetupNeeded () {
    logger.plain(`\n${this.getDivider()}`)
    logger.plain(`  ${red(bold('ATTENTION'))}: No frontend configuration could be found!`)
    logger.plain(`  This is needed to run the ${this.getPrefix()}!\n`)
    logger.plain(this.getDivider())
    logger.plain('Please answer the following questions:\n')
  }

  /**
   * Logs the Rapid Dev Server startup information.
   */
  logStartUp () {
    logger.plain('  The development server is started. You can access the output by:\n')
    logger.plain(`     ${cyan(`http://localhost:${process.env.port}`)}\n`)
    logger.plain(`  Press ${cyan.bold('CTRL-C')} to stop the server!\n`)
    logger.plain(this.getDivider())
  }

  logExit () {
    logger.plain(`\n\n${this.getDivider()}`)
    logger.plain(`  ${green('S H O P G A T E')}   ${blue('C L O U D')}\n`)
    logger.plain(bold(`  The development process has been ended by your request!\n`))
    logger.plain('  See you soon!\n')
    logger.plain(`${this.getDivider()}\n\n`)
  }
}

module.exports = new LogHelper()
