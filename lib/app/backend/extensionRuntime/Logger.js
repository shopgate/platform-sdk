const bunyan = require('bunyan')

/**
 * @class Logger
 * @implements Internal.Logger
 */
class Logger {
  constructor () {
    Object.keys(bunyan.levelFromName).forEach((level) => {
      this[level] = function () {
        process.send({ type: 'log', level, arguments: Array.from(arguments) })
      }

      this[`sys${level.charAt(0).toUpperCase()}${level.slice(1)}`] = function () {
        process.send({ type: 'systemLog', level, arguments: Array.from(arguments) })
      }
    })
  }
}

module.exports = Logger
