'use strict'

const glob = require('glob')
const path = require('path')
const logger = require('./lib/logger')

const actionFiles = glob.sync('./lib/actions/**/*.js', {cwd: __dirname, strict: true})
actionFiles.forEach((actionFile) => {
  const actionName = path.basename(actionFile).split('.')[0]
  module.exports[actionName] = require(actionFile)
})

process.on('uncaughtException', /* istanbul ignore next */ function (err) {
  if (err.code && err.message) {
    logger.error(`${err.message} (${err.code})`)
  } else {
    logger.error(err)
  }
  process.exit(1)
})
