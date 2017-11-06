/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

exports.ENV_KEY_DEVELOPMENT = 'development'
exports.ENV_KEY_PRODUCTION = 'production'

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = exports.ENV_KEY_DEVELOPMENT
}

module.exports = {
  ENV: process.env.NODE_ENV,
  isDev: (process.env.NODE_ENV === exports.ENV_KEY_DEVELOPMENT),
  isProd: (process.env.NODE_ENV === exports.ENV_KEY_PRODUCTION)
}
