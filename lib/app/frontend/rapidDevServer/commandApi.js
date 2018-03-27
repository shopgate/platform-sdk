/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const async = require('neo-async')

/**
 * The mock api endpoint for app commands
 * @param {Object} req The request object.
 * @param {Object} res The response object.
 * @param {Function} next The middleware switch.
 */
const commandApi = (req, res, next) => /* istanbul ignore next */{
  const { cmds } = req.body

  if (cmds && cmds.length !== 0) {
    let responseCommands = []

    async.eachSeries(cmds, (command, callback) => {
      const commandHandler = require(`./appCommands/${command.c}`)

      if (!commandHandler) {
        return callback(new Error(`Command '${command.c}' not found!`))
      }

      commandHandler(command.p, (error, commands) => {
        if (error) {
          return callback(error)
        }

        responseCommands = responseCommands.concat(commands)
        callback()
      })

      return null
    }, (error) => {
      if (error) {
        return next(error)
      }

      return res.json({
        ver: '9.0',
        vars: {},
        cmds: responseCommands
      })
    })
  }
}

module.exports = commandApi
