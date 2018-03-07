/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const sinon = require('sinon')
const assert = require('assert')
const sendDataRequest = require('../../../../../lib/app/frontend/rapidDevServer/appCommands/sendDataRequest')

let command = null
const callback = sinon.spy((error, response) => {
  if (error) {
    throw new Error(error)
  }

  command = response
})

const expected1 = {
  c: 'dataResponse',
  p: {
    pageId: 'http://somedomain',
    serial: '1234567',
    status: 200,
    body: JSON.stringify({}),
    bodyContentType: 'application/json; charset=UTF-8',
    maxAge: 0
  }
}

const expected2 = {
  c: 'dataResponse',
  p: {
    pageId: 'sgapi:pipeline_cart_add_product',
    serial: '1234567',
    status: 200,
    body: JSON.stringify({
      success: true,
      systemMessage: null,
      validationErrors: null,
      html: null,
      data: {
        cart: {
          amount: null,
          orderable: true,
          products: [],
          coupons: [],
          productsCount: 3
        }
      }
    }),
    bodyContentType: 'application/json; charset=UTF-8',
    maxAge: 0
  }
}

describe('sendDataRequest Command', () => {
  beforeEach(() => {
    callback.resetHistory()
  })

  it('should return the default command response', () => {
    sendDataRequest({
      src: 'http://somedomain',
      serial: '1234567'
    }, callback)

    sinon.assert.calledOnce(callback)
    assert.equal(JSON.stringify(expected1), JSON.stringify(command))
  })

  it('should remove sgapi: from the action', () => {
    sendDataRequest({
      src: 'sgapi:pipeline_cart_add_product',
      serial: '1234567'
    }, callback)

    sinon.assert.calledOnce(callback)
    assert.equal(JSON.stringify(expected2), JSON.stringify(command))
  })
})
