/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { bold } = require('chalk')
const assert = require('assert')
const sinon = require('sinon')
const proxyquire = require('proxyquire')

const logger = {
  plain: sinon.spy()
}

const logHelper = proxyquire('../../../lib/app/frontend/LogHelper', {
  '../../logger': logger
})

process.env.silent = false

describe('LogHelper', () => {
  afterEach(() => {
    logger.plain.resetHistory()
  })

  it('should return the divider', () => {
    assert.equal(logHelper.divider, logHelper.getDivider())
  })

  it('should return the prefix', () => {
    assert.equal(logHelper.prefix, logHelper.getPrefix())
  })

  it('should log the silent mode information', () => {
    process.env.silent = true

    logHelper.logSilentMode()
    sinon.assert.calledWith(logger.plain, bold('  SILENT MODE: logs will be suppressed.\n'))

    process.env.silent = false
  })

  it('should log the dev server logo', () => {
    logHelper.logLogo()
    sinon.assert.called(logger.plain)
  })

  it('should log the setup logo', () => {
    logHelper.logSetupLogo()
    sinon.assert.called(logger.plain)
  })

  it('should log the setup needed logo', () => {
    logHelper.logSetupNeeded()
    sinon.assert.called(logger.plain)
  })

  it('should show a start up log', () => {
    logHelper.logStartUp()
    sinon.assert.called(logger.plain)
  })
})
