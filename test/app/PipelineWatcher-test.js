const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const PipelineWatcher = require('../../lib/app/backend/PipelineWatcher')
const utils = require('../../lib/utils/utils')
const AppSettings = require('../../lib/app/AppSettings')

const appPath = path.join('build', 'appsettings')

describe('PipelineWatcher', () => {
  let pipelineWatcher
  let extensionsPipelineFolder

  beforeEach(async () => {
    process.env.APP_PATH = appPath
    extensionsPipelineFolder = path.join(utils.getApplicationFolder(), AppSettings.EXTENSIONS_FOLDER, 'testExtension', 'pipelines')
    pipelineWatcher = new PipelineWatcher({getApplicationFolder: utils.getApplicationFolder})
    fsEx.emptyDirSync(extensionsPipelineFolder)
    await pipelineWatcher.start()
  })

  afterEach((done) => {
    delete process.env.APP_PATH
    pipelineWatcher.close()
    fsEx.remove(extensionsPipelineFolder, done)
  })

  it('should emit changed pipeline', (done) => {
    const pipelinePath = path.join(extensionsPipelineFolder, 'somePipeline.json')

    pipelineWatcher.on('all', (event, file) => {
      assert.equal(event, 'add')
      assert.equal(file, pipelinePath)
      done()
    })

    fsEx.writeJson(pipelinePath, {someAttribtue: '2'}, (err) => { assert.ifError(err) })
  })

  it('should stop watching', () => {
    pipelineWatcher.close()
    assert.ok(pipelineWatcher.watcher.closed)
  })
})
