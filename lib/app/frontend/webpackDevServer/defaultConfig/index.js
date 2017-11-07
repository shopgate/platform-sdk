/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { isProd } = require('../environment')

let config

if (isProd) {
  config = require('./config/prod')
} else {
  config = require('./config/dev')
}

module.exports = config
