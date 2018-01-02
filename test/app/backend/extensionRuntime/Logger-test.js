const Logger = require('../../../../lib/app/backend/extensionRuntime/Logger')
const assert = require('assert')
const bunyan = require('bunyan')
const sinon = require('sinon')

describe('ExtensionRuntime Logger', () => {
  const logLevels = Object.keys(bunyan.levelFromName)
  const syslogLevels = logLevels.map((logLevel) => `sys${logLevel.charAt(0).toUpperCase()}${logLevel.slice(1)}`)
  const resultingLogLevels = logLevels.concat(syslogLevels)

  it('should expose functions equal to bunyan log levels plus system log levels', () => {
    const actualLogLevels = Object.keys(new Logger())
    resultingLogLevels.forEach((logLevel) => {
      assert.ok(actualLogLevels.indexOf(logLevel) >= 0)
    })
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

    for (let i = 0; i < logLevels.length; i++) {
      const level = logLevels[i]
      it(`should call process.send with type:log, level:${level} and passed arguments`, () => {
        const args = [{foo: 'bar'}, 'foobar']
        logger[level](...args)
        assert(process.send.calledOnce, 'called once')
        assert(process.send.calledWith({type: 'log', level, arguments: args}), 'called with correct arguments')
      })
    }
  })
})
