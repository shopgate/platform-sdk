const assert = require('assert')
const nock = require('nock')
const DcHttpClient = require('../lib/DcHttpClient')
const UserSettings = require('../lib/user/UserSettings')
const path = require('path')
const fsEx = require('fs-extra')
const UnauthorizedError = require('../lib/errors/UnauthorizedError')

describe('DcHttpClient', () => {
  let dcClient

  before(() => {
    process.env.USER_PATH = path.join('build', 'usersettings')
    fsEx.emptyDirSync(process.env.USER_PATH)
  })

  after(() => {
    fsEx.removeSync(process.env.USER_PATH)
    delete process.env.USER_PATH
  })

  beforeEach(async () => {
    dcClient = new DcHttpClient(await new UserSettings().setToken({}), {debug: () => {}})
  })

  describe('getInfos', () => {
    const infoType = 'foobarInfoType'
    const appId = 'foobarAppId'
    const deviceId = 'foobarDeviceId'

    it('should get infos', (done) => {
      const data = {foo: {body: {bar: 'foobar'}}}
      const dcMock = nock(dcClient.dcAddress)
        .get(`/applications/${appId}/${infoType}/${deviceId}`)
        .reply(200, data)

      dcClient.getInfos(infoType, appId, deviceId, (err, body) => {
        assert.ifError(err)
        assert.deepEqual(body, data)
        dcMock.done()
        done()
      })
    })

    it('should update the usertoken on jwt-update', async () => {
      const newToken = 'foobarTokenNew45662'
      const dcMock = nock(dcClient.dcAddress)
        .get(`/applications/${appId}/${infoType}/${deviceId}`)
        .reply(200, null, {'x-jwt': newToken})

      dcClient.getInfos(infoType, appId, deviceId, async (err) => {
        assert.ifError(err)
        assert.equal(await dcClient.userSettings.getToken(), newToken)
        dcMock.done()
      })
    })

    it('should callback error on dc error', (done) => {
      const dcMock = nock(dcClient.dcAddress)
        .get(`/applications/${appId}/${infoType}/${deviceId}`)
        .reply(500)

      dcClient.getInfos(infoType, appId, deviceId, (err) => {
        assert.ok(err)
        dcMock.done()
        done()
      })
    })
  })

  describe('downloadPipelines', () => {
    const appId = 'foobarAppId'

    it('should get a pipeline', () => {
      const body = {pipelines: ['foo', 'bar']}
      const dcMock = nock(dcClient.dcAddress)
        .get(`/applications/${appId}/pipelines`)
        .reply(200, body)

      return dcClient.downloadPipelines(appId, false).then(pipelines => {
        assert.deepEqual(pipelines, body.pipelines)
        dcMock.done()
      })
    })

    it('should update the usertoken on jwt-update', async () => {
      const newToken = 'foobarTokenNew13456'
      const dcMock = nock(dcClient.dcAddress)
        .get(`/applications/${appId}/pipelines`)
        .reply(200, {}, {'x-jwt': newToken})

      await dcClient.downloadPipelines(appId, false)
      assert.equal(await dcClient.userSettings.getToken(), newToken)
      dcMock.done()
    })

    it('should callback error on dc-error', () => {
      const dcMock = nock(dcClient.dcAddress)
        .get(`/applications/${appId}/pipelines`)
        .reply(500)

      return dcClient.downloadPipelines(appId, false).catch(err => {
        assert.ok(err)
        dcMock.done()
      })
    })
  })

  describe('uploadPipeline', () => {
    it('should update a pipeline', () => {
      const dcMock = nock(dcClient.dcAddress)
        .put('/applications/shop_10006/pipelines/someId')
        .reply(204)

      return dcClient.uploadPipeline({pipeline: {id: 'someId'}}, 'shop_10006', false).then(() => {
        dcMock.done()
      })
    })

    it('should update the usertoken on jwt-update', async () => {
      const newToken = 'newToken134'
      const dcMock = nock(dcClient.dcAddress)
        .put('/applications/shop_10006/pipelines/someId')
        .reply(204, {}, {'x-jwt': newToken})

      await dcClient.uploadPipeline({pipeline: {id: 'someId'}}, 'shop_10006', false)
      assert.equal(await dcClient.userSettings.getToken(), newToken)
      dcMock.done()
    })

    it('should return an error on dc-error', () => {
      const dcMock = nock(dcClient.dcAddress)
        .put('/applications/shop_10006/pipelines/someId')
        .reply(500)

      return dcClient.uploadPipeline({pipeline: {id: 'someId'}}, 'shop_10006', false).catch(err => {
        assert.ok(err)
        dcMock.done()
      })
    })
  })

  describe('removePipeline', () => {
    it('should remove a pipeline', () => {
      const dcMock = nock(dcClient.dcAddress)
        .delete('/applications/shop_10006/pipelines/someId')
        .reply(204)

      return dcClient.removePipeline('someId', 'shop_10006', false).then(() => {
        dcMock.done()
      })
    })

    it('should update the usertoken on jwt-update', async () => {
      const newToken = 'newToken4123'
      const dcMock = nock(dcClient.dcAddress)
        .delete('/applications/shop_10006/pipelines/someId')
        .reply(204, {}, {'x-jwt': newToken})

      await dcClient.removePipeline('someId', 'shop_10006', false)
      assert.equal(await dcClient.userSettings.getToken(), newToken)
      dcMock.done()
    })

    it('should return an error on dc-error', () => {
      const dcMock = nock(dcClient.dcAddress)
        .delete('/applications/shop_10006/pipelines/someId')
        .reply(500)

      return dcClient.removePipeline('someId', 'shop_10006', false).catch(err => {
        assert.ok(err)
        dcMock.done()
      })
    })
  })

  describe('setStartPageUrl', () => {
    it('should set the start page url', (done) => {
      const startPageUrl = 'http://someurl'
      const dcMock = nock(dcClient.dcAddress)
        .put('/applications/shop_10006/settings/startpage', {startPageUrl})
        .reply(204)

      dcClient.setStartPageUrl('shop_10006', startPageUrl, (err) => {
        assert.ifError(err)
        dcMock.done()
        done()
      })
    })

    it('should update the usertoken on jwt-update', (done) => {
      const newToken = 'newToken341'
      const dcMock = nock(dcClient.dcAddress)
        .put('/applications/shop_10006/settings/startpage')
        .reply(204, {}, {'x-jwt': newToken})

      dcClient.setStartPageUrl('shop_10006', 'http://someurl', (err) => {
        assert.ifError(err)
        dcClient.userSettings.getToken().then(token => {
          assert.equal(token, newToken)
          dcMock.done()
          done()
        })
      })
    })

    it('should return an error on dc-error', (done) => {
      const dcMock = nock(dcClient.dcAddress)
        .put('/applications/shop_10006/settings/startpage')
        .reply(500)

      dcClient.setStartPageUrl('shop_10006', 'http://someurl', (err) => {
        assert.ok(err)
        dcMock.done()
        done()
      })
    })
  })

  describe('generateConfig', () => {
    const appId = 'foobarAppId'
    const extId = 'testExt'

    it('should get a config', () => {
      const body = {id: extId}
      const dcMock = nock(dcClient.dcAddress)
        .post(`/applications/${appId}/extensions/${extId}/generateConfig`)
        .reply(200, body)

      return dcClient.generateExtensionConfig({id: extId}, appId)
        .then((config) => {
          assert.deepEqual(config, body)
          dcMock.done()
        })
        .catch(err => assert.ifError(err))
    })

    it('should update the usertoken on jwt-update', () => {
      const newToken = 'foobarTokenNew34'
      const dcMock = nock(dcClient.dcAddress)
        .post(`/applications/${appId}/extensions/${extId}/generateConfig`)
        .reply(200, {}, {'x-jwt': newToken})

      return dcClient.generateExtensionConfig({id: extId}, appId)
        .then(() => {
          dcClient.userSettings.getToken().then(token => {
            assert.equal(token, newToken)
            dcMock.done()
          })
        })
        .catch(err => assert.ifError(err))
    })

    it('should callback error on dc-error', () => {
      const dcMock = nock(dcClient.dcAddress)
        .post(`/applications/${appId}/extensions/${extId}/generateConfig`)
        .reply(500)

      return dcClient.generateExtensionConfig({id: extId}, appId)
        .then(() => dcMock.done())
        .catch(err => assert.equal(err.message, 'Could not generate Extension-Config'))
    })
  })

  describe('getApplicationData', async () => {
    const appId = 'foobarAppId'

    it('should get application data', async () => {
      const data = {foo: {body: {bar: 'foobar'}}}
      const dcMock = nock(dcClient.dcAddress)
        .get(`/applications/${appId}`)
        .reply(200, data)

      await dcClient.getApplicationData(appId, (err, body) => {
        assert.ifError(err)
        assert.deepEqual(body, data)
        dcMock.done()
      })
    })

    it('should callback unauthorized error on dc unauthorized error', (done) => {
      console.log(appId)
      const dcMock = nock(dcClient.dcAddress)
        .get(`/applications/${appId}`)
        .reply(401, {message: 'Error!'})

      dcClient.getApplicationData(appId, (err) => {
        assert.ok(err)
        assert.ok(err instanceof UnauthorizedError, 'Error needs to be from type UnauthorizedError')
        dcMock.done()
        done()
      })
    })

    it('should callback error on dc error', (done) => {
      const dcMock = nock(dcClient.dcAddress)
        .get(`/applications/${appId}`)
        .reply(500)

      dcClient.getApplicationData(appId, (err) => {
        assert.ok(err)
        dcMock.done()
        done()
      })
    })
  })
})
