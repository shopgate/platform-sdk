const assert = require('assert')
const nock = require('nock')
const Session = require('../lib/user/Session')
const DCHttpClient = require('../lib/DCHttpClient')

describe('DCHttpClient', () => {
  let dcClient

  beforeEach(() => {
    dcClient = new DCHttpClient()
  })

  it('should get a pipeline', (done) => {
    nock(dcClient.dcAddress)
      .get('/applications/shop_10006/pipelines')
      .reply(200, {pipelines: []})

    let session = new Session({token: ''})

    dcClient.getPipelines('shop_10006', session, (err) => {
      assert.ifError(err)
      done()
    })
  })

  it('should update the usertoken on jwt-update', (done) => {
    nock(dcClient.dcAddress)
      .get('/applications/shop_10006/pipelines')
      .reply(200, {pipelines: []}, {'x-jwt': 'newToken'})

    let session = new Session({token: ''})

    dcClient.getPipelines('shop_10006', session, (err) => {
      assert.ifError(err)
      assert.equal(session.token, 'newToken')
      done()
    })
  })

  it('should return an error on dc-error', (done) => {
    nock(dcClient.dcAddress)
      .get('/applications/shop_10006/pipelines')
      .reply(500)

    let session = new Session({token: ''})

    dcClient.getPipelines('shop_10006', session, (err) => {
      assert.ok(err)
      done()
    })
  })
})
