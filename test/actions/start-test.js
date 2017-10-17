const action = require('../../lib/actions/start')
const assert = require('assert')

describe('actions', () => {
  describe('start', () => {
    it('should throw (not implemented yet)', () => {
      assert.throws(action)
    })

    it('should have a cmd function', (done) => {
      let doneCount = 0
      function isDone () {
        if (doneCount++ === 2) done()
      }

      assert.equal(typeof action.cmd, 'function')

      const commander = {
        command: (c) => {
          assert.equal(c, 'start')
          isDone()
          return commander
        },
        description: (d) => {
          assert.equal(d, 'start the sdk')
          isDone()
          return commander
        },
        action: (a) => {
          assert.equal(a, action)
          isDone()
          return commander
        }
      }

      action.cmd(commander)
    })
  })
})
