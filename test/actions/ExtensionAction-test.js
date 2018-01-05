const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const sinon = require('sinon')
const async = require('neo-async')
const nock = require('nock')

const UserSettings = require('../../lib/user/UserSettings')
const AppSettings = require('../../lib/app/AppSettings')
const ExtensionAction = require('../../lib/actions/ExtensionAction')
const logger = require('../../lib/logger')

const userSettingsFolder = path.join('build', 'usersettings')
const appPath = path.join('build', 'appsettings')

describe('ExtensionAction', () => {
  const action = new ExtensionAction()

  beforeEach(() => {
    process.env.USER_PATH = userSettingsFolder
    process.env.APP_PATH = appPath
    const appId = 'foobarTest'

    const appSettings = new AppSettings()
    fsEx.emptyDirSync(path.join(appPath, AppSettings.SETTINGS_FOLDER))
    appSettings.setId(appId).setAttachedExtensions({}).save().init()
    AppSettings.setInstance(appSettings)

    fsEx.emptyDirSync(userSettingsFolder)
    UserSettings.getInstance().getSession().token = {}
  })

  afterEach((done) => {
    UserSettings.setInstance()
    AppSettings.setInstance()
    delete process.env.USER_PATH
    delete process.env.APP_PATH
    async.parallel([
      (cb) => fsEx.remove(userSettingsFolder, cb),
      (cb) => fsEx.remove(appPath, cb)
    ], done)
  })

  describe('attaching and detaching', () => {
    describe('general', () => {
      it('should register', () => {
        const commander = {}
        commander.command = sinon.stub().returns(commander)
        commander.description = sinon.stub().returns(commander)
        commander.action = sinon.stub().returns(commander)
        commander.option = sinon.stub().returns(commander)

        action.register(commander)

        assert(commander.command.calledWith('extension-create [types...]'))
        assert(commander.description.calledWith('creates a new extension'))
        assert(commander.option.calledWith('--extension [extensionName]', 'Name of the new extension'))
        assert(commander.option.calledWith('--organization [organizationName]', 'Name of the organization this extension belongs to'))
        assert(commander.option.calledWith('--trusted [type]', 'only valid if you\'re about to create a backend extension'))

        assert(commander.command.calledWith('extension <action> [extensions...]'))
        assert(commander.description.calledWith('attaches or detaches one or more extensions'))

        assert(commander.action.callCount === 2)
      })

      it('should throw if user not logged in', () => {
        UserSettings.getInstance().getSession().token = null
        try {
          action.run('attach')
        } catch (err) {
          assert.equal(err.message, 'not logged in')
        }
      })

      it('should throw if invalid action is given', () => {
        try {
          action.run('invalid')
        } catch (err) {
          assert.equal(err.message, 'unknown action "invalid"')
        }
      })
    })

    describe('attaching', () => {
      it('should attach if extension exists locally', () => {
        const name = 'existentExtension'
        const id = 'extId'

        const extPath = path.join(appPath, 'extensions', name)
        fsEx.ensureDirSync(extPath)
        fsEx.writeJSONSync(path.join(extPath, 'extension-config.json'), {id})

        action.run('attach', [name])
        assert.deepEqual(AppSettings.getInstance().attachedExtensions[id], {path: name, trusted: false})
      })

      it('should attach all local extensions if no one is given', () => {
        const name1 = 'existentExtension1'
        const name2 = 'existentExtension2'

        const extPath1 = path.join(appPath, 'extensions', name1)
        const extPath2 = path.join(appPath, 'extensions', name2)
        fsEx.ensureDirSync(extPath1)
        fsEx.ensureDirSync(extPath2)
        fsEx.writeJSONSync(path.join(extPath1, 'extension-config.json'), {id: 'existentExtension1'})
        fsEx.writeJSONSync(path.join(extPath2, 'extension-config.json'), {id: 'existentExtension2'})

        action.run('attach', [name1])
        action.run('attach')

        assert.deepEqual(AppSettings.getInstance().attachedExtensions, {
          existentExtension1: { path: 'existentExtension1', trusted: false },
          existentExtension2: { path: 'existentExtension2', trusted: false }
        })
      })

      it('should throw an error if extension does not exist locally', () => {
        const name = 'notExitstentExtension'

        try {
          action.run('attach', [name])
        } catch (e) {
          assert.equal(e.message, `Config file of 'notExitstentExtension' is invalid or not existent`)
        }
      })

      it('should throw an error if extension-config is invalid', () => {
        const name = 'existentExtension'

        const extPath = path.join(appPath, 'extensions', name)
        fsEx.ensureDirSync(extPath)
        fsEx.writeJSONSync(path.join(extPath, 'extension-config.json'), {})

        try {
          action.run('attach', [name])
        } catch (e) {
          assert.equal(e.message, `Config file of '${name}' is invalid or not existent`)
        }

        assert.deepEqual(AppSettings.getInstance().attachedExtensions, {})
      })

      it('should throw an error if extension is already attached', () => {
        const name = 'existentExtension'

        const extPath = path.join(appPath, 'extensions', name)
        fsEx.ensureDirSync(extPath)
        fsEx.writeJSONSync(path.join(extPath, 'extension-config.json'), {id: name})

        action.run('attach', [name])
        try {
          action.run('attach', [name])
        } catch (e) {
          assert.equal(e.message, `Extension 'existentExtension (existentExtension) is already attached`)
        }
      })
    })

    describe('detaching', () => {
      it('should detach a extension', () => {
        const name = 'existentExtension'

        const extPath = path.join(appPath, 'extensions', name)
        fsEx.ensureDirSync(extPath)
        fsEx.writeJSONSync(path.join(extPath, 'extension-config.json'), {id: name})

        AppSettings.getInstance().attachExtension(name, {id: name, trusted: false})
        action.run('detach', [name])
        assert.deepEqual(AppSettings.getInstance().attachedExtensions, {})
      })

      it('should skip if extension was not attached', (done) => {
        const name = 'notExitstentExtension'

        const extPath = path.join(appPath, 'extensions', name)
        fsEx.ensureDirSync(extPath)
        fsEx.writeJSONSync(path.join(extPath, 'extension-config.json'), {id: name})

        logger.warn = (text) => {
          assert.equal(text, `The extension '${name}' is not attached`)
          done()
        }

        action.run('detach', [name])
      })

      it('should detach all extensions if none was specified', () => {
        AppSettings.getInstance().attachExtension('ext1', {id: 'ext1'})
        AppSettings.getInstance().attachExtension('ext2', {id: 'ext2'})

        action.run('detach')
        assert.deepEqual(AppSettings.getInstance().attachedExtensions, {})
      })
    })
  })

  describe('extension create', () => {
    const extensionFolder = path.join('build', 'extensions')

    beforeEach((done) => {
      nock.disableNetConnect()
      fsEx.ensureDirSync(extensionFolder)
      done()
    })

    afterEach((done) => {
      nock.enableNetConnect()
      fsEx.removeSync(extensionFolder)
      done()
    })

    describe('general', () => {
      it('should create an extension', (done) => {
        const action = new ExtensionAction()

        action.getUserInput = () => { return new Promise((resolve, reject) => { resolve({}) }) }
        action.downloadBoilerplate = () => { return new Promise((resolve, reject) => { resolve({}) }) }
        action.renameBoilerplate = () => { return new Promise((resolve, reject) => { resolve({}) }) }
        action.removeUnusedDirs = () => { return new Promise((resolve, reject) => { resolve({}) }) }
        action.removePlaceHolders = () => { return new Promise((resolve, reject) => { resolve({}) }) }
        action.updateBackendFiles = () => { return new Promise((resolve, reject) => { resolve({}) }) }
        action.installFrontendDependencies = () => { return new Promise((resolve, reject) => { resolve({}) }) }

        action.createExtension(null, null).then(() => {
          done()
        })
      })

      it('should catch an error because of sth.', (done) => {
        const action = new ExtensionAction()

        action.getUserInput = () => { return new Promise((resolve, reject) => { reject(new Error('error')) }) }

        action.createExtension(null, null).then(() => {
          done()
        })
      })
    })

    describe('getUserInput', () => {
      it('should get the user input by command', (done) => {
        const options = {
          extension: 'e1',
          organization: 'o1',
          trusted: 'trusted'
        }
        const types = ['backend', 'frontend']

        const externalUserInput = {}
        const expected = { extensionName: 'e1',
          organizationName: 'o1',
          trusted: false,
          toBeCreated: { frontend: true, backend: true }
        }

        new ExtensionAction().getUserInput(options, types, externalUserInput).then(() => {
          assert.deepEqual(externalUserInput, expected)
          done()
        })
      })
    })

    describe('downloadBoilerplate', () => {
      it('should download and unzip the boilerplate', (done) => {
        const state = {}

        const n = nock('https://github.com')
          .get('/shopgate/cloud-sdk-boilerplate-extension/archive/master.zip')
          .replyWithFile(200, path.join('test', 'testfiles', 'cloud-sdk-boilerplate-extension.zip'), {'Content-Type': 'application/zip'})

        new ExtensionAction().downloadBoilerplate(extensionFolder, state).then(() => {
          assert.ok(fsEx.existsSync(path.join(extensionFolder, 'cloud-sdk-boilerplate-extension-master')))
          assert.ok(state.cloned)
          n.done()
          done()
        })
      })

      it('should fail because of error while loading or unzipping', (done) => {
        const state = {}

        const n = nock('https://github.com')
        .get('/shopgate/cloud-sdk-boilerplate-extension/archive/master.zip')
        .reply(404, {error: 'error'})

        new ExtensionAction().downloadBoilerplate(extensionFolder, state).catch((err) => {
          assert.ok(err.message.startsWith('Error while downloading boilerplate'))
          n.done()
          done()
        })
      })
    })

    describe('renameBoilerplate', () => {
      const oldName = 'foo'
      const newName = 'bar'

      const userInput = { extensionName: newName }
      const defaultPath = path.join(extensionFolder, oldName)
      const state = {}

      it('should rename the boilerplate dir', (done) => {
        fsEx.ensureDirSync(path.join(extensionFolder, oldName))

        new ExtensionAction().renameBoilerplate(userInput, defaultPath, extensionFolder, state).then(() => {
          const newPath = path.join(extensionFolder, 'bar')
          assert.equal(state.extensionPath, newPath)
          assert.ok(state.moved)
          assert.ok(fsEx.existsSync(newPath))
          done()
        })
      })

      it('should fail because moving failed', (done) => {
        fsEx.ensureDirSync(path.join(extensionFolder, oldName))
        fsEx.ensureDirSync(path.join(extensionFolder, newName))

        new ExtensionAction().renameBoilerplate(userInput, defaultPath, extensionFolder, state).catch((err) => {
          assert.ok(err.message.indexOf('EEXIST') !== -1)
          done()
        })
      })
    })

    describe('removeUnusedDirs', () => {
      const extensionPath = path.join(extensionFolder, 'ex1')

      it('should remove the unused dirs', (done) => {
        const userInput = {
          toBeCreated: {
            backend: false,
            frontend: false
          }
        }

        const state = { extensionPath }

        const dirs = [
          path.join(extensionPath, 'frontend'),
          path.join(extensionPath, 'extension'),
          path.join(extensionPath, 'pipelines')
        ]

        dirs.forEach((dir) => fsEx.ensureDirSync(dir))

        new ExtensionAction().removeUnusedDirs(userInput, state).then(() => {
          dirs.forEach((dir) => assert.ok(!fsEx.existsSync(dir)))
          done()
        })
      })
    })

    describe('removePlaceHolders', () => {
      const extensionPath = path.join(extensionFolder, 'ex1')

      beforeEach((done) => {
        fsEx.ensureDirSync(extensionPath)
        done()
      })

      afterEach((done) => {
        fsEx.removeSync(extensionFolder)
        done()
      })

      it('should remove all occurences of /awesomeExtension/ and /awesomeOrgani[s|z]ation/', (done) => {
        const userInput = {
          extensionName: 'e1',
          organizationName: 'o1'
        }

        const state = { extensionPath }

        const files = [
          path.join(extensionPath, 'sth.json'),
          path.join(extensionPath, 'sth.js')
        ]

        files.forEach((file) => fsEx.writeJsonSync(file, {awesomeExtension: 'awesomeOrganization'}))

        new ExtensionAction().removePlaceHolders(userInput, state).then(() => {
          files.forEach((file) => assert.deepEqual(fsEx.readJsonSync(file), {e1: 'o1'}))
          done()
        })
      })

      it('should catch the "No files match the pattern" error', (done) => {
        const userInput = {
          extensionName: 'e1',
          organizationName: 'o1'
        }

        const state = { extensionPath }

        const file = path.join(extensionPath, 'sth.jsx')
        fsEx.writeJsonSync(file, {awesomeExtension: 'awesomeOrganization'})

        new ExtensionAction().removePlaceHolders(userInput, state).then(() => {
          assert.deepEqual(fsEx.readJsonSync(file), {awesomeExtension: 'awesomeOrganization'})
          done()
        })
      })
    })

    describe('updateBackendFiles', () => {
      const extensionPath = path.join(extensionFolder, 'ex1')

      beforeEach((done) => {
        fsEx.ensureDirSync(extensionPath)
        done()
      })

      afterEach((done) => {
        fsEx.removeSync(extensionFolder)
        done()
      })

      it('should update/rename backend files', (done) => {
        const userInput = {
          trusted: true,
          organizationName: 'o1',
          toBeCreated: {
            backend: true
          }
        }
        const state = { extensionPath }

        const pipelineDir = path.join(extensionPath, 'pipelines')
        fsEx.ensureDirSync(pipelineDir)
        fsEx.writeJSON(path.join(pipelineDir, 'awesomeOrganization.awesomePipeline.json'), {})

        const exConfFile = path.join(extensionPath, 'extension-config.json')
        fsEx.writeJSON(exConfFile, {})

        new ExtensionAction().updateBackendFiles(userInput, state).then(() => {
          assert.ok(fsEx.exists(path.join(extensionPath, 'pipelines', 'o1.awesomePipeline.json')))
          assert.deepEqual(fsEx.readJsonSync(exConfFile), {trusted: true})
          done()
        })
      })

      it('should return early because the function has nothing to do', () => {
        assert.doesNotThrow(() => new ExtensionAction().updateBackendFiles({toBeCreated: {}}, {}))
      })
    })

    describe('installFrontendDependencies', () => {
      const extensionPath = path.join(extensionFolder, 'ex1')
      const frontendPath = path.join(extensionPath, 'frontend')

      beforeEach((done) => {
        fsEx.ensureDirSync(frontendPath)
        done()
      })

      afterEach((done) => {
        fsEx.removeSync(frontendPath)
        done()
      })

      it('should install the frontend dependencies', (done) => {
        const state = { extensionPath }
        const userInput = {
          toBeCreated: {
            frontend: true
          }
        }

        fsEx.writeJsonSync(path.join(frontendPath, 'package.json'), {})

        const c = {
          command: 'ls',
          params: ['-la']
        }

        new ExtensionAction().installFrontendDependencies(userInput, state, c).then(() => {
          done()
        })
      })

      it('should return early because the function has nothing to do', () => {
        assert.doesNotThrow(() => new ExtensionAction().installFrontendDependencies({toBeCreated: {}}, {}, {}))
      })
    })
  })
})
