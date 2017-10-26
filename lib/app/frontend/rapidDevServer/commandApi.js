const async = require('async-neo')

/**
 * The mock api endpoint for app commands
 * @param {Object} req The request object.
 * @param {Object} res The response object.
 * @param {Function} next The middleware switch.
 */
const commandApi = (req, res, next) => {
  const { cmds } = req.body

  if (cmds && cmds.length !== 0) {
    let responseCommands = []

    async.eachSeries(cmds, (command, callback) => {
      const fn = require(`./appCommands/${command.c}`)

      if (!fn) return callback(new Error(`Command '${command.c}' not found`))

      fn(command.p, (err, commands) => {
        if (err) return callback(err)
        responseCommands = responseCommands.concat(commands)
        callback()
      })

      return null
    }, (err) => {
      if (err) return next(err)

      return res.json({
        ver: '9.0',
        vars: {},
        cmds: responseCommands
      })
    })
  }
}

module.exports = commandApi
