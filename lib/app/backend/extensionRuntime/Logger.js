const bunyan = require('bunyan')

class Logger {
  constructor () {
    Object.keys(bunyan.levelFromName).forEach((level) => {
      this[level] = function () {
        process.send({type: 'log', level, arguments: Array.from(arguments)})
      }
    })
  }
}

module.exports = Logger