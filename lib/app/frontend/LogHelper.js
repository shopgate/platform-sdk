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
   * Logs using bunyan logger.
   */
  log (...args) {
    logger.plain(...args)
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
      this.log(bold('  SILENT MODE: logs will be suppressed.\n'))
    }

    return this
  }

  /**
   * Logs the server logo.
   * @returns {LogHelper}
   */
  logLogo () {
    this.log(`\n${this.getDivider()}`)
    this.log(`  ${green('S H O P G A T E')}   ${blue('C L O U D')}`)
    this.log('  D E V E L O P M E N T   S E R V E R\n')
    this.log(this.getDivider())
    this.logSilentMode()

    return this
  }

  logSetupLogo () {
    this.log(`\n${this.getDivider()}`)
    this.log(`  ${green('S H O P G A T E')}   ${blue('C L O U D')}`)
    this.log('  F R O N T E N D   S E T U P\n')
    this.log(this.getDivider())
    this.log('This will guide you through the setup process.')
    this.log('Please answer the following questions:\n')

    return this
  }

  logSetupNeeded () {
    this.log(`\n${this.getDivider()}`)
    this.log(`  ${red(bold('ATTENTION'))}: No frontend configuration could be found!`)
    this.log(`  This is needed to run the ${this.getPrefix()}!\n`)
    this.log(this.getDivider())
    this.log('Please answer the following questions:\n')

    return this
  }

  /**
   * Logs the Rapid Dev Server startup information.
   * @returns {LogHelper}
   */
  logStartUp () {
    this.log(`  Localhost: ${cyan(`http://localhost:${process.env.apiPort}`)}`)
    this.log(`  LAN:       ${cyan(`http://${process.env.ip}:${process.env.apiPort}`)}\n`)
    this.log(`  Press ${cyan.bold('CTRL-C')} to stop the server!\n`)
    this.log(this.getDivider())

    return this
  }
}

module.exports = LogHelper
