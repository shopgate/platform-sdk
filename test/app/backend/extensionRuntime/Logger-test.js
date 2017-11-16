const Logger = require('../../../../lib/app/backend/extensionRuntime/Logger')
const assert = require('assert')
const bunyan = require('bunyan')
const LOG_LEVELS = Object.keys(bunyan.levelFromName)
const sinon = require('sinon')

describe('ExtensionRuntime Logger', () => {
  it('should expose functions equal to bunyan log levels', () => {
    assert.deepEqual(Object.keys(new Logger()), LOG_LEVELS)
  })

  describe('test each log level', () => {
    const logger = new Logger()
    if (!process.send) process.send = function () {}
    let spy
    beforeEach(() => {
      spy = sinon.spy(process, 'send')
    })
    afterEach(() => {
      spy.restore()
    })

    for (let i = 0; i < LOG_LEVELS.length; i++) {
      const level = LOG_LEVELS[i]
      it(`should call process.send with type:log, level:${level} and passed arguments`, () => {
        const args = [{foo: 'bar'}, 'foobar']
        logger[level](...args)
        assert(process.send.calledOnce, 'called once')
        assert(process.send.calledWith({type: 'log', level, arguments: args}), 'called with correct arguments')
      })
    }
  })
})
