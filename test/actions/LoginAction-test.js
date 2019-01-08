const assert = require('assert')
const fsEx = require('fs-extra')
const mockStdin = require('mock-stdin').stdin
const nock = require('nock')
const os = require('os')
const path = require('path')
const sinon = require('sinon')
const { promisify } = require('util')
const DcHttpClient = require('../../lib/DcHttpClient')
const LoginAction = require('../../lib/actions/LoginAction')
const config = require('../../lib/config')
const UserSettings = require('../../lib/user/UserSettings')

describe('LoginAction', () => {
  let settingsFolder
  let stdin
  let userSettings
  let dcHttpClient
  let subjectUnderTest

  before(async () => {
    settingsFolder = await promisify(fsEx.mkdtemp)(path.join(os.tmpdir(), 'sgtest-'))
    config.load({ userDirectory: settingsFolder })
  })

  beforeEach(async () => {
    stdin = mockStdin()
    process.env.SGCLOUD_DC_ADDRESS = 'http://dc.shopgate.cloud'
    nock.disableNetConnect()
    process.env.SGCLOUD_USER = ''
    process.env.SGCLOUD_PASS = ''
    await fsEx.emptyDir(settingsFolder)
    userSettings = new UserSettings()
    dcHttpClient = new DcHttpClient(userSettings, null)
    subjectUnderTest = new LoginAction(userSettings, dcHttpClient)
  })

  afterEach(async () => {
    delete process.env.USER_PATH
    delete process.env.SGCLOUD_DC_ADDRESS
    delete process.env.SGCLOUD_USER
    delete process.env.SGCLOUD_PASS
    nock.enableNetConnect()
    await fsEx.emptyDir(settingsFolder)
  })

  after(async () => fsEx.remove(settingsFolder))

  it('should register', () => {
    const commander = {}
    commander.command = sinon.stub().returns(commander)
    commander.description = sinon.stub().returns(commander)
    commander.option = sinon.stub().returns(commander)
    commander.action = sinon.stub().returns(commander)

    LoginAction.register(commander, null, userSettings)

    assert(commander.command.calledWith('login'))
    assert(commander.option.calledWith('--username [email]'))
    assert(commander.option.calledWith('--password [password]'))
    assert(commander.description.calledOnce)
    assert(commander.action.calledOnce)
  })

  it('should login using command line params', async () => {
    const api = nock('http://dc.shopgate.cloud')
      .post('/login', { username: 'foo', password: 'bar' })
      .reply(200, { accessToken: 'token' })

    const options = { username: 'foo', password: 'bar' }
    try {
      await subjectUnderTest.run(options)
      api.done()
      const sessionToken = await userSettings.getToken()
      assert.equal(sessionToken, 'token')
      const sessionUser = await userSettings.getUsername()
      assert.equal(sessionUser, 'foo')
    } catch (err) {
      assert.ifError(err)
    }
  })

  it('should login asking for username and password', async () => {
    const api = nock('http://dc.shopgate.cloud')
      .post('/login', { username: 'foo', password: 'bar' })
      .reply(200, { accessToken: 'token2' })

    try {
      setTimeout(() => {
        stdin.send('foo\n')
        setTimeout(() => {
          stdin.send('bar\n')
        }, 50)
      }, 50)
      await subjectUnderTest.run({})
      api.done()
      assert.equal(await userSettings.getToken(), 'token2')
      assert.equal(await userSettings.getUsername(), 'foo')
    } catch (err) {
      assert.ifError(err)
    }
  })

  it('should login using password from commandline and user from env', async () => {
    process.env.SGCLOUD_USER = 'foo'
    const api = nock('http://dc.shopgate.cloud')
      .post('/login', { username: 'foo', password: 'bar' })
      .reply(200, { accessToken: 'token3' })

    try {
      setTimeout(() => stdin.send('bar\n'), 10)

      await subjectUnderTest.run({})
      api.done()
      assert.equal(await userSettings.getToken(), 'token3')
      assert.equal(await userSettings.getUsername(), 'foo')
    } catch (err) {
      assert.ifError(err)
    }
  })

  it('should login using user from commandline and password from parameter', async () => {
    const api = nock('http://dc.shopgate.cloud')
      .post('/login', { username: 'foo', password: 'bar' })
      .reply(200, { accessToken: 'token4' })

    const options = { password: 'bar' }
    try {
      setTimeout(() => stdin.send('foo\n'), 50)
      await subjectUnderTest.run(options)
      api.done()
      assert.equal(await userSettings.getToken(), 'token4')
      assert.equal(await userSettings.getUsername(), 'foo')
    } catch (err) {
      assert.ifError(err)
    }
  })

  it('should fail login in with invalid credentials', async () => {
    const api = nock('http://dc.shopgate.cloud')
      .post('/login', { username: 'foo', password: 'bar' })
      .reply(400)

    const options = { username: 'foo', password: 'bar' }

    try {
      await subjectUnderTest.run(options)
    } catch (err) {
      assert.ok(err)
      assert.equal(await userSettings.getUsername(), undefined)
      assert.equal(err.message, 'Login failed')
      api.done()
    }
  })

  it(`should not write username to session on invalid login`, async () => {
    const api = nock('http://dc.shopgate.cloud')
      .post('/login', { username: 'foo', password: 'bar' })
      .reply(400)

    const options = { username: 'foo', password: 'bar' }
    try {
      await subjectUnderTest.run(options)
    } catch (err) {
      assert.ok(err)
      assert.equal(await userSettings.getUsername(), undefined)
      assert.equal(err.message, 'Login failed')
      api.done()
    }
  })
  it('should repopulate the username if possible', async () => {
    const wait = async (ms) => (new Promise(resolve => setTimeout(resolve, ms)))

    let api = nock('http://dc.shopgate.cloud')
      .post('/login', { username: 'foo', password: 'bar' })
      .reply(200, { accessToken: 'token4' })

    const options = { username: 'foo', password: 'bar' }
    await subjectUnderTest.run(options)
    await wait(50)
    api.done()
    subjectUnderTest.options = {}
    delete process.env.SGCLOUD_USER
    let retry = nock('http://dc.shopgate.cloud')
      .post('/login', { username: 'foo', password: 'bar' })
      .reply(200, { accessToken: 'token4' })

    const promise = subjectUnderTest.run({})
    await wait(50)
    stdin.send('\n')
    await wait(50)
    stdin.send('bar\n')
    await wait(50)
    return promise.then(() => (retry.done()))
  })
})
