const bunyan = require('bunyan')
const bformat = require('bunyan-format')
const formatOut = bformat({outputMode: 'short', color: true})

/**
 * @type {{trace:Function, debug:Function, info:Function, warn:Function, error:Function, child:Function, level:Function, levels:Function}}
 */
const logger = bunyan.createLogger({
  name: '\u0008',
  streams: [
    {
      level: process.env.LOG_LEVEL || 'info',
      stream: formatOut
    }
  ]
})
logger.plain = console.log

module.exports = logger
