/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const sinon = require('sinon')
const assert = require('assert')
const appStart = require('../../../../../lib/app/frontend/rapidDevServer/appCommands/appStart')

let command = null
const callback = sinon.spy((error, response) => {
  if (error) {
    throw new Error(error)
  }

  command = response
})

const expected = [
  {
    c: 'startMonitoringResources',
    p: {
      __dummy__: '__dummy__'
    }
  },
  {
    c: 'openPage',
    p: {
      targetTab: 'main',
      src: `http://127.0.0.0:8080/`,
      title: '',
      emulateBrowser: false
    }
  },
  {
    c: 'hideSplashScreen',
    p: {
      __dummy__: '__dummy__'
    }
  },
  {
    c: 'showTab',
    p: {
      targetTab: 'main'
    }
  }
]

describe('appStart Command', () => {
  it('should return the correct app start', () => {
    process.env.ip = '127.0.0.0'
    process.env.port = 8080

    appStart(null, callback)

    sinon.assert.calledOnce(callback)
    assert.equal(JSON.stringify(expected), JSON.stringify(command))
  })
})
