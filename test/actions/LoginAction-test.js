const assert = require('assert')
const path = require('path')
const nock = require('nock')
const sinon = require('sinon')
const LoginAction = require('../../lib/actions/LoginAction')
const UserSettings = require('../../lib/user/UserSettings')
const settingsFolder = path.join('build', 'user')
const fsEx = require('fs-extra')

describe('LoginAction', () => {
  let stdin
  let userSettings
  let subjectUnderTest

  beforeEach(async () => {
    process.env.USER_PATH = settingsFolder
    process.env.SGCLOUD_DC_ADDRESS = 'http://dc.shopgate.cloud'
    nock.disableNetConnect()
    process.env.SGCLOUD_USER = ''
    process.env.SGCLOUD_PASS = ''
    stdin = require('mock-stdin').stdin()
    await fsEx.emptyDir(settingsFolder)
    userSettings = new UserSettings()
    subjectUnderTest = new LoginAction(userSettings)
  })

  afterEach(async () => {
    delete process.env.USER_PATH
    delete process.env.SGCLOUD_DC_ADDRESS
    delete process.env.SGCLOUD_USER
    delete process.env.SGCLOUD_PASS
    nock.enableNetConnect()
    await fsEx.remove(settingsFolder)
  })

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
      .post('/login', {username: 'foo', password: 'bar'})
      .reply(200, {accessToken: 'token'})

    const options = {username: 'foo', password: 'bar'}
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
      .post('/login', {username: 'foo', password: 'bar'})
      .reply(200, {accessToken: 'token2'})

    try {
      setTimeout(() => {
        stdin.send('foo\n')
        setTimeout(() => {
          stdin.send('bar\n')
        }, 10)
      }, 10)
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
      .post('/login', {username: 'foo', password: 'bar'})
      .reply(200, {accessToken: 'token3'})

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
      .post('/login', {username: 'foo', password: 'bar'})
      .reply(200, {accessToken: 'token4'})

    const options = {password: 'bar'}
    try {
      setTimeout(() => stdin.send('foo\n'), 10)
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
      .post('/login', {username: 'foo', password: 'bar'})
      .reply(400)

    const options = {username: 'foo', password: 'bar'}

    try {
      await subjectUnderTest.run(options)
    } catch (err) {
      assert.ok(err)
      assert.equal(await userSettings.getUsername(), undefined)
      assert.equal(err.message, 'Login failed')
      api.done()
    }
  })

  it('should not write username to session on invalid login', async () => {
    const api = nock('http://dc.shopgate.cloud')
      .post('/login', {username: 'foo', password: 'bar'})
      .reply(400)

    const options = {username: 'foo', password: 'bar'}
    try {
      await subjectUnderTest.run(options)
    } catch (err) {
      assert.ok(err)
      assert.equal(await userSettings.getUsername(), undefined)
      assert.equal(err.message, 'Login failed')
      api.done()
    }
  })

  it('should store and repopulate the username when logged in successfully', async () => {
    const api = nock('http://dc.shopgate.cloud')
      .post('/login', {username: 'foo', password: 'bar'})
      .reply(200, {accessToken: 'token3'})

    try {
      setTimeout(() => stdin.send('foo\n'), 10)
      setTimeout(() => stdin.send('bar\n'), 20)
      await subjectUnderTest.run({})

      api.done()
      assert.equal(await userSettings.getToken(), 'token3')
      assert.equal(await userSettings.getUsername(), 'foo')
      await userSettings.setToken(null)

      try {
        setTimeout(() => stdin.send('\n'), 30)
        setTimeout(() => stdin.send('bar\n'), 40)

        const nextLoginRequest = nock('http://dc.shopgate.cloud')
          .post('/login', {username: 'foo', password: 'bar'})
          .reply(200, {accessToken: 'token3'})

        await subjectUnderTest.run({})
        nextLoginRequest.done()
        assert.equal(await userSettings.getToken(), 'token3')
        assert.equal(await userSettings.getUsername(), 'foo')
      } catch (err) {
        assert.ifError(err)
      }
    } catch (err) {
      assert.ifError(err)
    }
  })
})
