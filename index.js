'use strict'

const path = require('path')
const glob = require('glob')
const logger = require('./lib/logger')
const actionFiles = glob.sync('./lib/actions/*.js', {cwd: __dirname, strict: true})

actionFiles.forEach((actionFile) => {
  module.exports[path.basename(actionFile).split('.')[0].split('Action')[0]] = require(actionFile)
})

process.on('uncaughtException', /* istanbul ignore next */ function (err) {
  if (err.code && err.message) {
    logger.error(`${err.message} (${err.code})`)
  } else {
    if (err.stack) {
      err.stack = err.stack.split('\n').slice(0, 4).join('\n')
    }
    logger.error(err)
  }
  process.exit(1)
})
