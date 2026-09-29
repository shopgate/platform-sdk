const path = require('path')
const { readdirSync } = require('node:fs')
const assert = require('assert')
const proxyquire = require('proxyquire').noPreserveCache()

const index = require('../')

const actionsFolder = path.join(__dirname, '..', 'lib', 'actions')

describe('index', () => {
  it('should export all actions', () => {
    const actionFiles = readdirSync(actionsFolder).filter((file) => file.endsWith('.js'))
    const actions = {}
    actionFiles.forEach((actionFile) => {
      actions[path.basename(actionFile).split('.')[0].split('Action')[0]] = require(path.join(actionsFolder, actionFile))
    })
    assert.deepEqual(Object.keys(index).sort(), Object.keys(actions).sort())
  })

  it('should ignore entries of the actions folder that are not javascript files', () => {
    const indexWithExtraEntries = proxyquire('../index', {
      'node:fs': {
        readdirSync: () => ['LogoutAction.js', 'README.md', '.DS_Store']
      }
    })

    assert.deepEqual(Object.keys(indexWithExtraEntries), ['Logout'])
    assert.strictEqual(indexWithExtraEntries.Logout, require('../lib/actions/LogoutAction'))
  })
})
