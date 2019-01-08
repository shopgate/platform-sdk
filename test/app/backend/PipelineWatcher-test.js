const assert = require('assert')
const fsEx = require('fs-extra')
const os = require('os')
const path = require('path')
const { promisify } = require('util')
const { EXTENSIONS_FOLDER } = require('../../../lib/app/Constants')
const PipelineWatcher = require('../../../lib/app/backend/PipelineWatcher')

describe('PipelineWatcher', () => {
  let appPath
  let pipelineWatcher
  let extensionsPipelineFolder

  before(async () => {
    appPath = await promisify(fsEx.mkdtemp)(path.join(os.tmpdir(), 'sgtest-'))
  })

  beforeEach(() => {
    process.env.APP_PATH = appPath
    extensionsPipelineFolder = path.join(appPath, EXTENSIONS_FOLDER, 'testExtension', 'pipelines')
    pipelineWatcher = new PipelineWatcher({ getApplicationFolder: () => appPath })
    return fsEx.emptyDir(extensionsPipelineFolder)
  })

  afterEach(() => {
    delete process.env.APP_PATH
  })

  after(async () => fsEx.remove(appPath))

  it('should emit changed pipeline', (done) => {
    const pipelinePath = path.join(extensionsPipelineFolder, 'somePipeline.json')
    const callbacks = []
    pipelineWatcher.chokidar = {
      closed: false,
      watch: (givenPath, options) => {
        assert.equal(givenPath, path.join(appPath, 'extensions', '*', 'pipelines', '*.json'))
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
