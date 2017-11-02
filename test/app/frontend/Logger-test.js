/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const Logger = require('../../../lib/app/frontend/Logger')
const assert = require('assert')

const logger = new Logger()

describe('Logger', () => {
  it('should give the prefix', () => {
    const prefix = logger.getPrefix()
    assert.equal(prefix, logger.getPrefix())
  })
})
