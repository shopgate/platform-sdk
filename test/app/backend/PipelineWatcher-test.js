const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const PipelineWatcher = require('../../../lib/app/backend/PipelineWatcher')
const { EXTENSIONS_FOLDER } = require('../../../lib/app/Constants')
const mockFs = require('mock-fs')
const appPath = path.join('build', 'appsettings')

describe('PipelineWatcher', () => {
  let pipelineWatcher
  let extensionsPipelineFolder

  beforeEach(() => {
    mockFs()
    process.env.APP_PATH = appPath
    extensionsPipelineFolder = path.join(appPath, EXTENSIONS_FOLDER, 'testExtension', 'pipelines')
    pipelineWatcher = new PipelineWatcher({getApplicationFolder: () => appPath})
    return fsEx.emptyDir(extensionsPipelineFolder)
  })

  afterEach(() => {
    delete process.env.APP_PATH
    mockFs.restore()
  })

  it('should emit changed pipeline', (done) => {
    const pipelinePath = path.join(extensionsPipelineFolder, 'somePipeline.json')
    const callbacks = []
    pipelineWatcher.chokidar = {
      closed: false,
      watch: (givenPath, options) => {
        assert.equal(givenPath, path.join('build/appsettings/extensions/**/pipelines', '*.json'))
        return pipelineWatcher.chokidar
      },
      on: (event, cb) => {
        if (event === 'ready') cb()
        if (!callbacks[event]) callbacks[event] = []
        callbacks[event].push(cb)
      },
      close: () => {
        setTimeout(() => {
          pipelineWatcher.chokidar.closed = true
        }, 30)
      }
    }

    pipelineWatcher.start().then(() => {
      pipelineWatcher.on('all', (event, file) => {
        assert.equal(event, 'add')
        assert.equal(file, pipelinePath)
        pipelineWatcher.close().then(() => done())
      })

      setTimeout(() => {
        callbacks['all'][0]('add', pipelinePath)
      }, 100)
    })
  })
})
