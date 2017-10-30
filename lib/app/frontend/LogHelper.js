/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { cyan, green, blue, red, bold } = require('chalk')

let instance

/**
 * The Logger class hold static functions for logging usefull informations when running
 * the Rapid Dev Server and the Webpack Dev Server.
 * @type {Logger}
 */
class LogHelper {
  /**
   * Creates an instance of LogHelper.
   * @returns {LogHelper}
   */
  static getInstance () {
    if (!instance) instance = new LogHelper()
    return instance
  }

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
   * Logs a server error nessage.
   * @param {[type]} message [description]
   * @return {[type]} [description]
   */
  logError (message) {
    console.log(`${this.getPrefix()} ${red(message)}`)
  }

  /**
   * Logs if silent mode is active and logs will be suppresed.
   * @returns {LogHelper}
   */
  logSilentMode () {
    // Only log if silent mode is active.
    if (process.env.silent) {
      console.log(bold('  SILENT MODE: logs will be suppressed.\n'))
    }

    return this
  }

  /**
   * Logs the server logo.
   * @returns {LogHelper}
   */
  logLogo () {
    console.log(`\n${this.getDivider()}`)
    console.log(`  ${green('S H O P G A T E')}   ${blue('C L O U D')}`)
    console.log('  D E V E L O P M E N T   S E R V E R\n')
    console.log(this.getDivider())
    this.logSilentMode()

    return this
  }

  logSetupLogo () {
    console.log(`\n${this.getDivider()}`)
    console.log(`  ${green('S H O P G A T E')}   ${blue('C L O U D')}`)
    console.log('  F R O N T E N D   S E T U P\n')
    console.log(this.getDivider())
    console.log('This will guide you through the setup process.')
    console.log('Please answer the following questions:\n')

    return this
  }

  logSetupNeeded () {
    console.log(`\n${this.getDivider()}`)
    console.log(`  ${red(bold('ATTENTION'))}: No frontend configuration could be found!`)
    console.log(`  This is needed to run the ${this.getPrefix()}!\n`)
    console.log(this.getDivider())
    console.log('Please answer the following questions:\n')

    return this
  }

  /**
   * Logs the Rapid Dev Server startup informations.
   * @returns {LogHelper}
   */
  logStartUp () {
    console.log(`  Localhost: ${cyan(`http://localhost:${process.env.port}`)}`)
    console.log(`  LAN:       ${cyan(`http://${process.env.ip}:${process.env.port}`)}\n`)
    console.log(`  Press ${cyan.bold('CTRL-C')} to stop the server!\n`)
    console.log(this.getDivider())

    return this
  }
}

module.exports = LogHelper
