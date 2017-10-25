const UserSettings = require('../../lib/user/UserSettings')
const assert = require('assert')
const rimraf = require('rimraf')
const path = require('path')
const fs = require('fs')

describe('UserSettings', () => {
  let testFolder

  beforeEach(() => {
    testFolder = path.join('test', 'usersettings')
    process.env.USER_PATH = testFolder
  })

  afterEach((done) => {
    delete process.env.USER_PATH
    rimraf(testFolder, done)
  })

  it('should have default settingsFolder', () => {
    delete process.env.USER_PATH
    assert.ok(new UserSettings().settingsFolder.includes('.sgcloud'))
  })

  it('should accept USER_PATH env as settingsFolder', () => {
    testFolder = path.join('test', '-testFoobar-')
    process.env.USER_PATH = testFolder
    assert.equal(new UserSettings().settingsFolder, testFolder)
  })

  it('should return (same) blank session', () => {
    const userSettings = new UserSettings()
    const session = userSettings.getSession()
    assert.equal(session, userSettings.getSession())
    assert.ok(!session.hasToken())
  })

  it('should return (same) session loaded from file', () => {
    const userSettings = new UserSettings()
    fs.writeFileSync(userSettings.sessionFile, JSON.stringify({}))

    const session = userSettings.getSession()
    assert.equal(session, userSettings.getSession())
    assert.ok(session.hasToken())
  })

  it('should save all settings', () => {
    const token = {foo: 'bar'}

    const userSettings = new UserSettings()
    userSettings.getSession().token = token
    userSettings.save()

    assert.deepEqual(JSON.parse(fs.readFileSync(userSettings.sessionFile)).token, token)
  })
})
