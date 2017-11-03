/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

// const sinon = require('sinon')
const assert = require('assert')
const proxyquire = require('proxyquire')
const rapidDevServer = proxyquire('../../../../lib/app/frontend/rapidDevServer/RapidDevServer', {

})

describe('RapidDevServer', () => {
  it('should throw an error if server already exists', (done) => {
    try {
      rapidDevServer.server = {}
      rapidDevServer.start()
      rapidDevServer.server = null
      done('Did not throw!')
    } catch (error) {
      assert.equal(error, rapidDevServer.existingServerError)
      rapidDevServer.server = null
      done()
    }
  })

  // it('should validate the environment', () => {
  //   const spy = sinon.spy(rapidDevServer, 'validateEnvironment')
  //   rapidDevServer.start()
  //   sinon.assert.calledOnce(spy)
  // })
})
