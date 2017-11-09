/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { argv } = require('yargs')
const {
  ENV_KEY_DEVELOPMENT,
  ENV_KEY_PRODUCTION
} = require('./constants')

if (argv.production) {
  process.env.NODE_ENV = ENV_KEY_PRODUCTION
} else {
  process.env.NODE_ENV = ENV_KEY_DEVELOPMENT
}

module.exports = {
  ENV: process.env.NODE_ENV,
  isDev: (process.env.NODE_ENV === ENV_KEY_DEVELOPMENT),
  isProd: (process.env.NODE_ENV === ENV_KEY_PRODUCTION)
}