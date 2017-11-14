const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const PipelineWatcher = require('../lib/PipelineWatcher')

const appPath = path.join('test', 'appsettings')

describe('PipelineWatcher', () => {
  let pipelineWatcher

  beforeEach(() => {
    process.env.APP_PATH = appPath

    pipelineWatcher = new PipelineWatcher()
    mkdirp.sync(path.join(appPath, 'pipelines'))
  })

  afterEach((done) => {
    pipelineWatcher.stop(() => {
      delete process.env.APP_PATH
      rimraf(appPath, done)
    })
  })

  it('should emit changed pipeline', (done) => {
    let writtenPipeline = {
      someAttribtue: '2'
    }

    pipelineWatcher.on('pipelineChanged', (pipeline) => {
      assert.deepEqual(pipeline, writtenPipeline)
      done()
    })

    pipelineWatcher.start()
    pipelineWatcher.watcher.interval = 1

    setTimeout(() => {
      fsEx.writeJsonSync(path.join(pipelineWatcher.pipelineFolder, 'somePipeline.json'), writtenPipeline)
    }, 5)
  })

  it('should not emit malformed pipeline', (done) => {
    let writtenPipeline = {
      someAttribtue: '2'
    }

    let counter = 0

    pipelineWatcher.on('pipelineChanged', (pipeline) => {
      assert.deepEqual(pipeline, writtenPipeline)
      counter++
    })

    pipelineWatcher.start()
    pipelineWatcher.watcher.interval = 1

    setTimeout(() => {
      fsEx.writeJsonSync(path.join(pipelineWatcher.pipelineFolder, 'somePipeline.json'), writtenPipeline)
      setTimeout(() => {
        fsEx.outputFileSync(path.join(pipelineWatcher.pipelineFolder, 'somePipeline.json'), '{someMalformed')
        setTimeout(() => {
          assert.equal(counter, 1)
          done()
        }, 5)
      }, 5)
    }, 5)
  })

  it('should stop watching on command', (done) => {
    pipelineWatcher.start()
    pipelineWatcher.stop(done)
  })
})
