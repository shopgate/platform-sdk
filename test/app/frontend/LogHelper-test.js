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

const logHelper = new LogHelper()

describe('LogHelper', () => {
  beforeEach(() => {
    logHelper.log = () => {}
  })

  it('should return the divider', () => {
    assert.equal(logHelper.divider, logHelper.getDivider())
  })

  it('should return the prefix', () => {
    assert.equal(logHelper.prefix, logHelper.getPrefix())
  })

  it('should log the silent mode information', () => {
    const spy = sinon.spy(logHelper, 'log')

    process.env.silent = true
    logHelper.logSilentMode()

    assert(spy.withArgs(bold('  SILENT MODE: logs will be suppressed.\n')).calledOnce)

    process.env.silent = false
    spy.restore()
  })

  it('should log the dev server logo', () => {
    const spy = sinon.spy(logHelper, 'log')

    logHelper.logLogo()

    assert.ok(spy.called)

    spy.restore()
  })

  it('should log the setup logo', () => {
    const spy = sinon.spy(logHelper, 'log')

    logHelper.logSetupLogo()

    assert.ok(spy.called)

    spy.restore()
  })

  it('should log the setup needed logo', () => {
    const spy = sinon.spy(logHelper, 'log')

    logHelper.logSetupNeeded()

    assert.ok(spy.called)

    spy.restore()
  })

  it('should show a start up log', () => {
    const spy = sinon.spy(logHelper, 'log')

    logHelper.logStartUp()

    assert.ok(spy.called)

    spy.restore()
  })
})
