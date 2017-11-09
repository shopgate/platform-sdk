const assert = require('assert')
const nock = require('nock')
const Session = require('../lib/user/Session')
const DCHttpClient = require('../lib/DCHttpClient')

describe('DCHttpClient', () => {
  let dcClient

  beforeEach(() => {
    dcClient = new DCHttpClient()
  })

  it('should update a pipeline', (done) => {
    nock(dcClient.dcAddress)
      .put('/applications/shop_10006/pipelines/someId')
      .reply(204)

    dcClient.updatePipeline({pipeline: {id: 'someId'}}, 'shop_10006', {getToken: () => { return '' }}, (err) => {
      assert.ifError(err)
      done()
    })
  })

  it('should update the usertoken on jwt-update', (done) => {
    nock(dcClient.dcAddress)
      .put('/applications/shop_10006/pipelines/someId')
      .reply(204, {}, {'x-jwt': 'newToken'})

    let session = new Session({token: ''})

    dcClient.updatePipeline({pipeline: {id: 'someId'}}, 'shop_10006', session, (err) => {
      assert.ifError(err)
      assert.equal(session.getToken(), 'newToken')
      done()
    })
  })

  it('should return an error on dc-error', (done) => {
    nock(dcClient.dcAddress)
      .put('/applications/shop_10006/pipelines/someId')
      .reply(500)

    dcClient.updatePipeline({pipeline: {id: 'someId'}}, 'shop_10006', {getToken: () => { return '' }}, (err) => {
      assert.ok(err)
      done()
    })
  })
})
