/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { join } = require('path')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const logger = require('../../../../lib/logger')
const THEMES_FOLDER = join(__dirname, 'mocks/themes')
const EXTENSIONS_FOLDER = join(__dirname, 'mocks/extensions')
const PWA_FOLDER = join(__dirname, 'mocks/pwa')

const dependencyLinker = proxyquire('../../../../lib/app/frontend/dependencyLinking/DependencyLinker', {
  '../../../app/AppSettings': {
    EXTENSIONS_FOLDER
  },
  '../../../app/frontend/FrontendSettings': {
    THEMES_FOLDER,
    PWA_FOLDER
  },
  'child_process': {
    // Prevent calling the real execSync
    execSync: () => {}
  }
})

describe('DependencyLinker', () => {
  let loggerStub
  let execSpy

  before(() => {
    /**
     * Replace the logger for this test, since logs are not that relevant here.
     * It's not possible via proxyquire, since the PackageParser within the DependencyLinker
     * will write a log for an invalid package. This situation is tested within the related test.
     */
    loggerStub = sinon.stub(logger, 'plain')
  })

  after(() => {
    loggerStub.restore()
  })

  beforeEach(() => {
    execSpy = sinon.spy(dependencyLinker, 'exec')
  })

  afterEach(() => {
    execSpy.restore()
  })

  it('should link everything without options', () => {
    dependencyLinker
      .init()
      .link()

    sinon.assert.callCount(execSpy, 17)
    sinon.assert.callOrder(
      execSpy.withArgs('npm link', join(PWA_FOLDER, 'pwa-common')),
      execSpy.withArgs('npm link', join(PWA_FOLDER, 'pwa-core')),
      execSpy.withArgs('npm link', join(PWA_FOLDER, 'eslint-config')),
      execSpy.withArgs('npm link @shopgate/pwa-common', join(THEMES_FOLDER, 'theme-gmd'), true),
      execSpy.withArgs('npm link @shopgate/pwa-core', join(THEMES_FOLDER, 'theme-gmd'), true),
      execSpy.withArgs('npm link @shopgate/eslint-config', join(THEMES_FOLDER, 'theme-gmd'), true),
      execSpy.withArgs('npm link @shopgate/pwa-common', join(THEMES_FOLDER, 'theme-ios11'), true),
      execSpy.withArgs('npm link @shopgate/pwa-core', join(THEMES_FOLDER, 'theme-ios11'), true),
      execSpy.withArgs('npm link @shopgate/eslint-config', join(THEMES_FOLDER, 'theme-ios11'), true),
      execSpy.withArgs('npm link @shopgate/pwa-common', join(EXTENSIONS_FOLDER, '@customscope/extension-one/frontend'), true),
      execSpy.withArgs('npm link @shopgate/eslint-config', join(EXTENSIONS_FOLDER, '@shopgate/commerce-widgets/frontend'), true),
      execSpy.withArgs('npm link @shopgate/pwa-common', join(EXTENSIONS_FOLDER, '@shopgate/commerce-widgets/frontend'), true),
      execSpy.withArgs('npm link @shopgate/pwa-core', join(EXTENSIONS_FOLDER, '@shopgate/commerce-widgets/frontend'), true),
      execSpy.withArgs('npm link @shopgate/pwa-common', join(EXTENSIONS_FOLDER, 'custom-extension/frontend'), true),
      execSpy.withArgs('npm link @shopgate/eslint-config', join(PWA_FOLDER, 'pwa-common'), true),
      execSpy.withArgs('npm link @shopgate/pwa-core', join(PWA_FOLDER, 'pwa-common'), true),
      execSpy.withArgs('npm link @shopgate/eslint-config', join(PWA_FOLDER, 'pwa-core'), true)
    )
  })

  it('should only link dependencies to the theme when option is set', () => {
    const options = {
      theme: 'ios11'
    }

    dependencyLinker
      .init(options)
      .link()

    sinon.assert.callCount(execSpy, 6)
    sinon.assert.callOrder(
      execSpy.withArgs('npm link', join(PWA_FOLDER, 'pwa-common')),
      execSpy.withArgs('npm link', join(PWA_FOLDER, 'pwa-core')),
      execSpy.withArgs('npm link', join(PWA_FOLDER, 'eslint-config')),
      execSpy.withArgs('npm link @shopgate/pwa-common', join(THEMES_FOLDER, 'theme-ios11'), true),
      execSpy.withArgs('npm link @shopgate/pwa-core', join(THEMES_FOLDER, 'theme-ios11'), true),
      execSpy.withArgs('npm link @shopgate/eslint-config', join(THEMES_FOLDER, 'theme-ios11'), true)
    )
  })

  it('should link nothing if no packages are set', () => {
    dependencyLinker
      .reset()
      .link()

    sinon.assert.callCount(execSpy, 0)
  })
})
