const assert = require('assert')
const BackendProcess = require('../../../lib/app/backend/BackendProcess')

describe('BackendProcess', () => {
  let backendProccess
  let mockServer
  let socket

  before(() => {
    process.env.SGCLOUD_DC_WS_ADDRESS = 'http://localhost:12223'
  })

  after(() => {
    delete process.env.SGCLOUD_DC_WS_ADDRESS
  })

  beforeEach((done) => {
    mockServer = require('socket.io').listen(12223)
    backendProccess = new BackendProcess()
    mockServer.on('connection', (sock) => { socket = sock })
    backendProccess.connect(done)
  })

  afterEach((done) => {
    backendProccess.disconnect()
    setTimeout(() => mockServer.close(done), 5) // Client has to disconnect first
  })

  describe('select application', () => {
    it('should select an application', (done) => {
      socket.on('selectApplication', (data, cb) => {
        assert.deepEqual(data, {applicationId: 'shop_10006'})
        cb()
      })
      backendProccess.selectApplication('shop_10006', done)
    })

    it('should fail if socket sends error', (done) => {
      socket.on('selectApplication', (data, cb) => {
        const err = new Error('Forbidden')
        err.code = 403
        cb(err)
      })
      backendProccess.selectApplication('shop_10006', err => {
        assert.ok(err)
        assert.equal(err.code, 403)
        done()
      })
    })

    it('should fail if socket is not open', (done) => {
      backendProccess.socket = null
      backendProccess.selectApplication('shop_10006', err => {
        backendProccess.socket = socket
        assert.ok(err)
        assert.equal(err.message, 'Connection not established')
        done()
      })
    })
  })
})
