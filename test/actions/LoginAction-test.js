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

  beforeEach(() => {
    process.env.USER_PATH = settingsFolder
    process.env.SGCLOUD_DC_ADDRESS = 'http://dc.shopgate.cloud'
    nock.disableNetConnect()
    process.env.SGCLOUD_USER = ''
    process.env.SGCLOUD_PASS = ''
    stdin = require('mock-stdin').stdin()
  })

  afterEach((done) => {
    delete process.env.USER_PATH
    delete process.env.SGCLOUD_DC_ADDRESS
    delete process.env.SGCLOUD_USER
    delete process.env.SGCLOUD_PASS
    UserSettings.setInstance()
    nock.enableNetConnect()
    fsEx.remove(settingsFolder, done)
  })

  it('should register', () => {
    const commander = {}
    commander.command = sinon.stub().returns(commander)
    commander.description = sinon.stub().returns(commander)
    commander.option = sinon.stub().returns(commander)
    commander.action = sinon.stub().returns(commander)

    new LoginAction().register(commander)

    assert(commander.command.calledWith('login'))
    assert(commander.option.calledWith('--username [email]'))
    assert(commander.option.calledWith('--password [password]'))
    assert(commander.description.calledOnce)
    assert(commander.action.calledOnce)
  })

  it('should login using command line params', (done) => {
    const api = nock('http://dc.shopgate.cloud')
      .post('/login', {username: 'foo', password: 'bar'})
      .reply(200, {accessToken: 'token'})

    const options = {username: 'foo', password: 'bar'}
    const login = new LoginAction()
    login.run(options, err => {
      assert.ifError(err)
      api.done()
      assert.equal(UserSettings.getInstance().getSession().token, 'token')
      done()
    })
  })

  it('should login asking for username and password', (done) => {
    const api = nock('http://dc.shopgate.cloud')
      .post('/login', {username: 'foo', password: 'bar'})
      .reply(200, {accessToken: 'token2'})

    const login = new LoginAction()
    login.run({}, err => {
      assert.ifError(err)
      api.done()
      assert.equal(UserSettings.getInstance().getSession().token, 'token2')
      done()
    })

    setTimeout(() => {
      stdin.send('foo\n')
      setTimeout(() => stdin.send('bar\n'), 10)
    }, 10)
  })

  it('should login using password from commandline and user from env', (done) => {
    process.env.SGCLOUD_USER = 'foo'
    const api = nock('http://dc.shopgate.cloud')
      .post('/login', {username: 'foo', password: 'bar'})
      .reply(200, {accessToken: 'token3'})

    const login = new LoginAction()
    login.run({}, err => {
      assert.ifError(err)
      api.done()
      assert.equal(UserSettings.getInstance().getSession().token, 'token3')
      done()
    })

    setTimeout(() => stdin.send('bar\n'), 10)
  })

  it('should login using user from commandline and password from parameter', (done) => {
    const api = nock('http://dc.shopgate.cloud')
      .post('/login', {username: 'foo', password: 'bar'})
      .reply(200, {accessToken: 'token4'})

    const options = {password: 'bar'}
    const login = new LoginAction()
    login.run(options, err => {
      assert.ifError(err)
      api.done()
      assert.equal(UserSettings.getInstance().getSession().token, 'token4')
      done()
    })

    setTimeout(() => stdin.send('foo\n'), 10)
  })

  it('should fail loggin in with invalid credentials', (done) => {
    const api = nock('http://dc.shopgate.cloud')
      .post('/login', {username: 'foo', password: 'bar'})
      .reply(400)

    const options = {username: 'foo', password: 'bar'}
    const login = new LoginAction()
    login.run(options, err => {
      assert.ok(err)
      assert.equal(err.message, 'Login failed')
      api.done()
      assert.equal(UserSettings.getInstance().getSession().token, null)
      done()
    })
  })
})
