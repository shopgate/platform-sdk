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
   * @returns {LogHelper}
   */
  logSilentMode () {
    // Only log if silent mode is active.
    if (process.env.silent) {
      logger.plain(bold('  SILENT MODE: logs will be suppressed.\n'))
    }
  }

  /**
   * Logs the server logo.
   * @returns {LogHelper}
   */
  logLogo () {
    logger.plain(`\n${this.getDivider()}`)
    logger.plain(`  ${green('S H O P G A T E')}   ${blue('C L O U D')}`)
    logger.plain('  D E V E L O P M E N T   S E R V E R\n')
    logger.plain(this.getDivider())
    this.logSilentMode()
  }

  logLogoBuild () {
    logger.plain(`\n${this.getDivider()}`)
    logger.plain(`  ${green('S H O P G A T E')}   ${blue('C L O U D')}`)
    logger.plain('  B U I L D\n')
  }

  logBuildFinished () {
    logger.plain(`  ${green('SUCCESS')}: Your project has been built successfully.\n`)
    logger.plain(this.getDivider())
  }

  logSetupLogo () {
    logger.plain(`\n${this.getDivider()}`)
    logger.plain(`  ${green('S H O P G A T E')}   ${blue('C L O U D')}`)
    logger.plain('  F R O N T E N D   S E T U P\n')
    logger.plain(this.getDivider())
    logger.plain('This will guide you through the setup process.')
    logger.plain('Please answer the following questions:\n')
  }

  logSetupNeeded () {
    logger.plain(`\n${this.getDivider()}`)
    logger.plain(`  ${red(bold('ATTENTION'))}: No frontend configuration could be found!`)
    logger.plain(`  This is needed to run the ${this.getPrefix()}!\n`)
    logger.plain(this.getDivider())
    logger.plain('Please answer the following questions:\n')
  }

  /**
   * Logs the Rapid Dev Server startup information.
   * @returns {LogHelper}
   */
  logStartUp () {
    logger.plain(`  Localhost: ${cyan(`http://localhost:${process.env.apiPort}`)}`)
    logger.plain(`  LAN:       ${cyan(`http://${process.env.ip}:${process.env.apiPort}`)}\n`)
    logger.plain(`  Press ${cyan.bold('CTRL-C')} to stop the server!\n`)
    logger.plain(this.getDivider())
  }
}

module.exports = new LogHelper()
