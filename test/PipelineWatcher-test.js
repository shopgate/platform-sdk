const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const PipelineWatcher = require('../lib/PipelineWatcher')

const appPath = path.join('build', 'appsettings')

describe('PipelineWatcher', () => {
  let pipelineWatcher

  beforeEach(() => {
    process.env.APP_PATH = appPath
    pipelineWatcher = new PipelineWatcher({useFsEvents: false, interval: 1})
    mkdirp.sync(path.join(appPath, 'pipelines'))
  })

  afterEach((done) => {
    delete process.env.APP_PATH
    pipelineWatcher.stop(() => {
      rimraf(appPath, done)
    })
  })

  it('should emit changed pipeline', (done) => {
    const writtenPipeline = {someAttribtue: '2'}

    pipelineWatcher.on('pipelineChanged', (pipeline) => {
      assert.deepEqual(pipeline, writtenPipeline)
      done()
    })

    pipelineWatcher.start(() => {
      fsEx.writeJson(path.join(pipelineWatcher.pipelineFolder, 'somePipeline.json'), writtenPipeline, () => {})
    })
  })

  it('should not emit malformed pipeline', (done) => {
    const writtenPipeline = {someAttribtue: '2'}

    let counter = 0
    pipelineWatcher.on('pipelineChanged', (pipeline) => {
      if (counter++ > 0) return

      assert.deepEqual(pipeline, writtenPipeline)
      setTimeout(() => {
        assert.equal(counter, 1)
        done()
      }, 1000)
      fsEx.outputFile(path.join(pipelineWatcher.pipelineFolder, 'somePipeline.json'), '{someMalformedJson', () => {})
    })

    pipelineWatcher.start(() => {
      fsEx.writeJsonSync(path.join(pipelineWatcher.pipelineFolder, 'somePipeline.json'), writtenPipeline, () => {})
    })
  }).timeout(10000)

  it('should stop watching on command', (done) => {
    pipelineWatcher.start(() => {
      pipelineWatcher.stop(done)
    })
  })
})
