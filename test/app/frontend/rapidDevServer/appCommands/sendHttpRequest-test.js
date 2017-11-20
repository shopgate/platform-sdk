/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const sinon = require('sinon')
const assert = require('assert')
const proxyquire = require('proxyquire')

let error = null
const cookieJar = 'somejarSomething'
const response = {
  headers: ['some', 'headers'],
  statusCode: 200
}
const body = 'Some body'
const serial = '123456'
const expected = {
  c: 'httpResponse',
  p: {
    error,
    serial,
    response: {
      body,
      ...response
    }
  }
}
let command
const callback = sinon.spy((error, response) => {
  if (error) {
    throw error
  }

  command = response
})

let sendHttpRequest

describe('sendHttpRequest Command', () => {
  beforeEach(() => {
    sendHttpRequest = proxyquire('../../../../../lib/app/frontend/rapidDevServer/appCommands/sendHttpRequest', {
      request: function request (options, callback) {
        this.jar = () => cookieJar

        callback(error, response, body)
      }
    })
  })

  it('should return a valid command', () => {
    sendHttpRequest({
      serial
    }, callback)

    sinon.assert.calledOnce(callback)
    assert.equal(JSON.stringify(expected), JSON.stringify(command))
  })
})
