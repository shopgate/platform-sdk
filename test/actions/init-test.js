const action = require('../../lib/actions/init')
const assert = require('assert')

describe('init', () => {
  describe('init', () => {
    it('should throw (not implemented yet)', () => {
      assert.throws(action)
    })

    it('should have a cmd function', (done) => {
      let doneCount = 0
      function isDone () {
        if (doneCount++ === 3) done()
      }

      assert.equal(typeof action.cmd, 'function')

      const commander = {
        command: (c) => {
          assert.equal(c, 'init')
          isDone()
          return commander
        },
        description: (d) => {
          assert.equal(d, 'init the sdk')
          isDone()
          return commander
        },
        action: (a) => {
          assert.equal(a, action)
          isDone()
          return commander
        },
        option: (opt, desc) => {
          assert.equal(opt, '--appId <appId>')
          assert.equal(desc, 'set the Application ID you want to initialize')
          isDone()
          return commander
        }
      }

      action.cmd(commander)
    })
  })
})
