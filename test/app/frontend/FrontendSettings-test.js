/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
const fsEx = require('fs-extra')
const assert = require('assert')
const FrontendSettings = require('../../../lib/app/frontend/FrontendSettings')

describe('FrontendSettings', () => {
  let settingsPath
  let settings

  beforeEach(() => {
    settingsPath = 'foobar'
    settings = new FrontendSettings(settingsPath)
    return fsEx.ensureDir(settings.settingsFolder)
      .then(fsEx.writeJson(settings.frontendSettingsFile, {}))
  })

  afterEach(() => {
    return fsEx.remove(settings.settingsFolder)
  })

  it('can be instanciated', () => {
    assert.ok(settings instanceof FrontendSettings)
  })

  it('should not have an IP set', () => {
    assert.equal(typeof settings.getIpAddress(), 'undefined')
  })

  it('should set an IP address', () => {
    const IP = '12.13.14.15'

    settings.setIpAddress(IP)
    assert.equal(settings.getIpAddress(), IP)
  })

  it('should not have an port set', () => {
    assert.equal(typeof settings.getPort(), 'undefined')
  })

  it('should set an port address', () => {
    const PORT = 8080

    settings.setPort(PORT)
    assert.equal(settings.getPort(), PORT)
  })

  it('should not have an port set', () => {
    assert.equal(typeof settings.getPort(), 'undefined')
  })

  it('should set an port address', () => {
    const PORT = 8080

    settings.setPort(PORT)
    assert.equal(settings.getPort(), PORT)
  })

  it('should not have an api port set', () => {
    assert.equal(typeof settings.getPort(), 'undefined')
  })

  it('should set an api port address', () => {
    const API_PORT = 9666

    settings.setApiPort(API_PORT)
    assert.equal(settings.getApiPort(), API_PORT)
  })

  it('should not have an hmr port set', () => {
    assert.equal(typeof settings.getHmrPort(), 'undefined')
  })

  it('should set an hmr port address', () => {
    const HMR_PORT = 3000

    settings.setHmrPort(HMR_PORT)
    assert.equal(settings.getHmrPort(), HMR_PORT)
  })

  it('should not have an remote port set', () => {
    assert.equal(typeof settings.getRemotePort(), 'undefined')
  })

  it('should set an remote port address', () => {
    const REMOTE_PORT = 8000

    settings.setRemotePort(REMOTE_PORT)
    assert.equal(settings.getRemotePort(), REMOTE_PORT)
  })

  it('should not have an access token set', () => {
    assert.equal(typeof settings.getAccessToken(), 'undefined')
  })

  it('should set an access token address', () => {
    const ACCESS_TOKEN = 'abcabcabcabc'

    settings.setAccessToken(ACCESS_TOKEN)
    assert.equal(settings.getAccessToken(), ACCESS_TOKEN)
  })

  it('should not have an source maps type set', () => {
    assert.equal(typeof settings.getSourceMapsType(), 'undefined')
  })

  it('should set an source maps type address', () => {
    const SOURCE_MAPS_TYPE = 'source-map'

    settings.setSourceMapsType(SOURCE_MAPS_TYPE)
    assert.equal(settings.getSourceMapsType(), SOURCE_MAPS_TYPE)
  })
})
