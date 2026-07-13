const assert = require('assert')
const proxyquire = require('proxyquire').noPreserveCache()

describe('config', () => {
  it('should load dotenv quietly', () => {
    let options

    proxyquire('../lib/config', {
      dotenv: {
        config: (configOptions) => {
          options = configOptions
        }
      }
    })

    assert.deepEqual(options, { quiet: true })
  })
})
