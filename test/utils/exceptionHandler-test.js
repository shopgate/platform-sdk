const assert = require('assert')
const proxyquire = require('proxyquire')
const sinon = require('sinon').createSandbox()
const { SoftError } = require('../../lib/errors')

describe('exceptionHandler', () => {
  const logger = {
    plain: sinon.stub(),
    error: sinon.stub()
  }
  const exceptionHandler = proxyquire('../../lib/utils/exceptionHandler', {
    '../logger': logger
  })

  before(() => {
    sinon.stub(process, 'exit')
  })

  afterEach(() => {
    assert(process.exit.calledOnceWith(1))
    sinon.reset()
    delete process.env.LOG_LEVEL
  })

  after(() => {
    sinon.restore()
  })

  it('should not output SoftError', () => {
    const err = new SoftError('Non-critical error')
    exceptionHandler(err)
    sinon.assert.notCalled(logger.plain)
  })

  it('should format error message and code', () => {
    const err = new Error('Message')
    err.code = 123
    exceptionHandler(err)
    sinon.assert.calledOnce(logger.error)
    sinon.assert.calledWith(logger.error, `${err.message} (${err.code})`)
  })

  it('should output error message if no code provided', () => {
    const err = new Error('Message')
    exceptionHandler(err)
    sinon.assert.calledOnce(logger.error)
    sinon.assert.calledWith(logger.error, err.message)
  })

  it('should output error stack if DEBUG log level is set', () => {
    process.env.LOG_LEVEL = 'debug'
    const err = new Error('Message')
    exceptionHandler(err)
    sinon.assert.calledOnce(logger.error)
    sinon.assert.calledWith(logger.error, err)
  })
})
