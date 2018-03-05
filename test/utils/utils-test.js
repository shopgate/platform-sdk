const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const proxyquire = require('proxyquire')
const { EXTENSIONS_FOLDER, THEMES_FOLDER } = require('../../lib/app/Constants')

const logger = {
  debug: (message) => {},
  warn: (message) => {},
  info: (message) => {}
}

const utils = proxyquire('../../lib/utils/utils', {
  '../logger': logger
})

describe('utils', () => {
  describe('resetProject', () => {
    const testProjectDir = path.join('build', 'testProject')

    const settingsDir = path.join(testProjectDir, '.sgcloud')
    const ext1Dir = path.join(testProjectDir, 'extensions', 'te1', 'extension')
    const ext2Dir = path.join(testProjectDir, 'extensions', 'te2', 'extension')
    const theme1Dir = path.join(testProjectDir, 'themes', 'tt1', 'config')
    const theme2Dir = path.join(testProjectDir, 'themes', 'tt2', 'config')
    const plDir = path.join(testProjectDir, 'pipelines')
    const tplDir = path.join(testProjectDir, 'trustedPipelines')

    const dirs = [
      settingsDir,
      ext1Dir,
      ext2Dir,
      theme1Dir,
      theme2Dir,
      plDir,
      tplDir
    ]

    const appFile = path.join(settingsDir, 'app.json')
    const storageFile = path.join(settingsDir, 'storage.json')
    const extensionsFile = path.join(settingsDir, 'attachedExtension.json')
    const ext1ConfFile = path.join(ext1Dir, 'config.json')
    const ext2ConfFile = path.join(ext2Dir, 'config.json')
    const theme1AppFile = path.join(theme1Dir, 'app.json')
    const theme2AppFile = path.join(theme2Dir, 'app.json')
    const pl = path.join(plDir, 'pl.json')
    const tpl = path.join(tplDir, 'tpl.json')

    const files = [
      appFile,
      storageFile,
      extensionsFile,
      ext1ConfFile,
      ext2ConfFile,
      theme1AppFile,
      theme2AppFile,
      pl,
      tpl
    ]

    beforeEach((done) => {
      process.env.APP_PATH = testProjectDir
      dirs.forEach(dir => fsEx.ensureDirSync(dir))
      files.forEach(file => fsEx.writeJSONSync(file, {}))
      done()
    })

    afterEach((done) => {
      delete process.env.APP_PATH
      fsEx.removeSync(testProjectDir)
      done()
    })

    it('should reset the project', (done) => {
      utils.resetProject()
      setTimeout(() => {
        files.forEach(file => assert.ok(!fsEx.pathExistsSync(file), `${file} should not exists`))
        done()
      }, 1000)
    })
  })

  describe('generateComponentsJson', () => {
    const projectDir = path.join('build', 'componentsJSON')

    const attachedExtensions = {
      '@a/b': {
        path: 'b'
      },
      '@a/c': {
        path: 'c'
      }
    }

    const extensionConfigs = {
      '@a/b': {
        components: [{
          id: 'comp1',
          type: 'type1',
          path: 'path1'
        }, {
          id: 'comp2',
          type: 'type2',
          path: 'path2'
        }]
      },
      '@a/c': {
        components: [{
          id: 'comp3',
          type: 'type3',
          path: 'path3'
        }, {
          id: 'comp4',
          type: 'type4',
          path: 'path4'
        }]
      }
    }

    const appSettings = {
      loadAttachedExtensions: () => attachedExtensions,
      getApplicationFolder: () => projectDir
    }

    const themes = [
      'gmd',
      'ios'
    ]

    beforeEach(async () => {
      await fsEx.ensureDir(projectDir)

      // ensure extensions and extension configs
      for (let extensionId in attachedExtensions) {
        const extDir = path.join(projectDir, EXTENSIONS_FOLDER, attachedExtensions[extensionId].path)
        await fsEx.ensureDir(extDir)
        await fsEx.writeJson(path.join(extDir, 'extension-config.json'), extensionConfigs[extensionId])
      }

      // ensure themes and theme config dirs
      for (let i in themes) {
        const themeDir = path.join(projectDir, THEMES_FOLDER, themes[i])
        await fsEx.ensureDir(path.join(themeDir, 'config'))
        await fsEx.writeJson(path.join(themeDir, 'extension-config.json'), {})
      }
    })

    afterEach(async () => {
      await fsEx.remove(projectDir)
    })

    it('should create components json', async () => {
      utils.generateComponentsJson(appSettings)

      const t1 = await fsEx.readJson(path.join(projectDir, THEMES_FOLDER, 'gmd', 'config', 'components.json'))
      const t2 = await fsEx.readJson(path.join(projectDir, THEMES_FOLDER, 'ios', 'config', 'components.json'))

      const expectedResult = {
        type1: { '@a/b/comp1': { path: 'b/path1' } },
        type2: { '@a/b/comp2': { path: 'b/path2' } },
        type3: { '@a/c/comp3': { path: 'c/path3' } },
        type4: { '@a/c/comp4': { path: 'c/path4' } }
      }

      assert.deepEqual(t1, expectedResult)
      assert.deepEqual(t2, expectedResult)
    })
  })
})
