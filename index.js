'use strict'

const path = require('path')
const glob = require('glob')
const actionFiles = glob.sync('./lib/actions/*.js', {cwd: __dirname, strict: true})
actionFiles.forEach((actionFile) => {
  module.exports[path.basename(actionFile).split('.')[0].split('Action')[0]] = require(actionFile)
})
