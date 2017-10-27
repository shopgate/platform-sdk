const assert = require('assert')
const path = require('path')
const rimraf = require('rimraf')
const nock = require('nock')

const LoginAction = require('../../lib/actions/LoginAction')
const Settings = require('../../lib/user/UserSettings')

const settingsFolder = path.join(__dirname, 'sgcloud-test')

describe('login', () => {
  let stdin

  beforeEach(() => {
    const set = Settings.getInstance()
    set.settingsFolder = settingsFolder
    set.init()
    process.env.SGCLOUD_DC_ADDRESS = 'http://dc.shopgate.cloud'
    nock.disableNetConnect()
    process.env.SGCLOUD_USER = ''
    process.env.SGCLOUD_PASS = ''
    stdin = require('mock-stdin').stdin()
  })

  afterEach(() => {
    Settings.setInstance()
    rimraf.sync(settingsFolder)
    nock.enableNetConnect()
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
      assert.equal(Settings.getInstance().getSession().token, 'token')
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
      assert.equal(Settings.getInstance().getSession().token, 'token2')
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
      assert.equal(Settings.getInstance().getSession().token, 'token3')
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
      assert.equal(Settings.getInstance().getSession().token, 'token4')
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
      assert.equal(Settings.getInstance().getSession().token, null)
      done()
    })
  })
})
