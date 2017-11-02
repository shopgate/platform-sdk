/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { argv } = require('yargs')
const {
  ENV_KEY_DEVELOPMENT,
  ENV_KEY_TEST,
  ENV_KEY_PRODUCTION,
  ENV_KEY_SETUP,
  ENV_KEY_RESET
} = require('./constants')

if (argv.test) {
  process.env.NODE_ENV = ENV_KEY_TEST
}

if (argv.production) {
  process.env.NODE_ENV = ENV_KEY_PRODUCTION
}

if (argv.setup) {
  process.env.NODE_ENV = ENV_KEY_SETUP
}

if (argv.reset) {
  process.env.NODE_ENV = ENV_KEY_RESET
}

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = ENV_KEY_DEVELOPMENT
}

const ENV = process.env.NODE_ENV

module.exports = {
  ENV,
  STACK: argv.stack || 'dev',
  SHOP: argv.shop || null,
  isDev: (ENV === ENV_KEY_DEVELOPMENT),
  isTest: (ENV === ENV_KEY_TEST),
  isProd: (ENV === ENV_KEY_PRODUCTION),
  isSetup: (ENV === ENV_KEY_SETUP),
  isReset: (ENV === ENV_KEY_RESET),
  isRemote: !!argv.remote,
  isRelease: (!!argv.release || !!argv['release-simple']),
  isSimpleRelease: !!argv['release-simple'],
  isLink: !!argv.link,
  isAnalyze: !!argv.analyze,
  projectPath: (process.env.PROJECT_PATH || process.cwd()),
  silent: !!argv.silent
}
