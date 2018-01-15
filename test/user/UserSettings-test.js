const UserSettings = require('../../lib/user/UserSettings')
const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')

describe('UserSettings', () => {
  let testFolder

  beforeEach(() => {
    testFolder = path.join('build', 'usersettings')
    process.env.USER_PATH = testFolder
  })

  afterEach((done) => {
    delete process.env.USER_PATH
    fsEx.remove(testFolder, done)
  })

  it('should have default settingsFolder', () => {
    delete process.env.USER_PATH
    assert.ok(new UserSettings().settingsFolder.includes('.sgcloud'))
  })

  it('should accept USER_PATH env as settingsFolder', () => {
    testFolder = path.join('build', '-testFoobar-')
    process.env.USER_PATH = testFolder
    assert.equal(new UserSettings().settingsFolder, testFolder)
  })

  it('should return session loaded from file', () => {
    const userSettings = new UserSettings()
    const session = {token: 'foo'}
    fsEx.ensureDirSync(userSettings.settingsFolder)
    fsEx.writeJsonSync(userSettings.sessionFile, {token: 'foo'})

    assert.equal(session.token, userSettings.getToken())
  })

  it('should save all settings', () => {
    const token = {foo: 'bar'}

    const userSettings = new UserSettings()
    userSettings.setToken(token)
    userSettings.validate()

    assert.deepEqual(fsEx.readJsonSync(userSettings.sessionFile).token, token)
  })
})
