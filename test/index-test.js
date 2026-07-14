const path = require('path')
const { globSync } = require('node:fs')
const assert = require('assert')
const proxyquire = require('proxyquire').noPreserveCache()

const index = require('../')

describe('index', () => {
  it('should export all actions', () => {
    const actionFiles = globSync('../lib/actions/*.js', { cwd: __dirname })
    const actions = {}
    actionFiles.forEach((actionFile) => {
      actions[path.basename(actionFile).split('.')[0].split('Action')[0]] = require(path.resolve(__dirname, actionFile))
    })
    assert.deepEqual(Object.keys(index).sort(), Object.keys(actions).sort())
  })

  it('should resolve action files returned without a leading dot slash', () => {
    const indexWithGlob13Path = proxyquire('../index', {
      'node:fs': {
        globSync: () => ['lib/actions/LogoutAction.js']
      }
    })

    assert.strictEqual(indexWithGlob13Path.Logout, require('../lib/actions/LogoutAction'))
  })
})
