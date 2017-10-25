'use strict'

const glob = require('glob')
const path = require('path')

const actionFiles = glob.sync('./lib/actions/**/*.js', {cwd: __dirname, strict: true})
actionFiles.forEach((actionFile) => {
  const actionName = path.basename(actionFile).split('.')[0]
  module.exports[actionName] = require(actionFile)
})
