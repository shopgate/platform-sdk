/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { bold } = require('chalk')
const assert = require('assert')
const sinon = require('sinon')
const LogHelper = require('../../../lib/app/frontend/LogHelper')

const consoleLogSpy = sinon.spy(console, 'log')
const logHelper = LogHelper.getInstance()

describe('LogHelper', () => {
  it('should return the divider', () => {
    const divider = logHelper.getDivider()
    assert.equal(divider, logHelper.getDivider())
  })

  it('should return the prefix', () => {
    const prefix = logHelper.getPrefix()
    assert.equal(prefix, logHelper.getPrefix())
  })

  it('should log the silent mode information', () => {
    process.env.silent = true

    logHelper.logSilentMode()
    assert(consoleLogSpy.withArgs(bold('  SILENT MODE: logs will be suppressed.\n')).calledOnce)
    process.env.silent = false
    consoleLogSpy.restore()
  })

  it('should log the dev server logo', () => {
    logHelper.logLogo()
    assert.ok(consoleLogSpy.called)
    consoleLogSpy.restore()
  })

  it('should log the setup logo', () => {
    logHelper.logSetupLogo()
    assert.ok(consoleLogSpy.called)
    consoleLogSpy.restore()
  })

  it('should log the setup needed logo', () => {
    logHelper.logSetupNeeded()
    assert.ok(consoleLogSpy.called)
    consoleLogSpy.restore()
  })

  it('should show a start up log', () => {
    logHelper.logStartUp()
    assert.ok(consoleLogSpy.called)
    consoleLogSpy.restore()
  })
})
