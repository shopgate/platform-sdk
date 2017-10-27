const index = require('../')
const path = require('path')
const glob = require('glob')
const assert = require('assert')

describe('index', () => {
  it('should export all actions', () => {
    const actionFiles = glob.sync('../lib/actions/*.js', {cwd: __dirname, strict: true})
    const actions = {}
    actionFiles.forEach((actionFile) => {
      actions[path.basename(actionFile).split('.')[0].split('Action')[0]] = require(actionFile)
    })

    assert.deepEqual(index, actions)
  })
})
