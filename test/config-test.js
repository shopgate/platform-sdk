const assert = require('assert')
const proxyquire = require('proxyquire').noPreserveCache()

describe('config', () => {
  it('should load the env file when it exists', () => {
    let loadedFile
    const loadEnvFile = process.loadEnvFile
    process.loadEnvFile = file => {
      loadedFile = file
    }

    try {
      proxyquire('../lib/config', {
        'node:fs': {
          existsSync: () => true
        }
      })
    } finally {
      process.loadEnvFile = loadEnvFile
    }

    assert.equal(loadedFile, require('path').resolve(process.cwd(), '.env'))
  })

  it('should not fail when the env file is missing', () => {
    assert.doesNotThrow(() => proxyquire('../lib/config', {
      'node:fs': {
        existsSync: () => false
      }
    }))
  })
})
