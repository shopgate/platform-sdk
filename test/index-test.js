const main = require('../')
const glob = require('glob')
const path = require('path')
const assert = require('assert')

describe('main', () => {
  it('should export each action', () => {
    const actionFiles = glob.sync('../lib/actions/*.js', {cwd: __dirname, strict: true})
    const actions = {}
    actionFiles.forEach((actionFile) => {
      const actionName = path.basename(actionFile).split('.')[0]
      actions[actionName] = require(actionFile)
    })

    assert.deepEqual(main, actions)
  })
})
