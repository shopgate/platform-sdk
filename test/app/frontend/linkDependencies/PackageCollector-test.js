/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const sinon = require('sinon')
const { join } = require('path')
const assert = require('assert')
const { red } = require('chalk')
const logger = require('../../../../lib/logger')
const PackageCollector = require('../../../../lib/app/frontend/linkDependencies/PackageCollector')
const { EXTENSIONS_FOLDER } = require('../../../../lib/app/AppSettings')
const { PWA_FOLDER } = require('../../../../lib/app/frontend/FrontendSettings')

describe('PackageCollector', () => {
  let packageCollector

  beforeEach(() => {
    packageCollector = new PackageCollector()
  })

  it('should collect packages for a single folder', () => {
    const dir = join(__dirname, `mocks/${PWA_FOLDER}`)
    const collection = packageCollector.get(dir)

    assert.deepEqual(collection, [
      { name: '@shopgate/eslint-config', path: join(dir, 'eslint-config') },
      { name: '@shopgate/pwa-common', path: join(dir, 'pwa-common') },
      { name: '@shopgate/pwa-core', path: join(dir, 'pwa-core') }
    ])
  })

  it('should collect packages for multiple folders', () => {
    const loggerStub = sinon.stub(logger, 'plain')
    const dirOne = join(__dirname, `mocks/${PWA_FOLDER}`)
    const dirTwo = join(__dirname, `mocks/${EXTENSIONS_FOLDER}`)

    const collection = packageCollector.get([dirOne, dirTwo])

    loggerStub.restore()

    assert.deepEqual(collection, [
      { name: '@shopgate/eslint-config', path: join(dirOne, 'eslint-config') },
      { name: '@shopgate/pwa-common', path: join(dirOne, 'pwa-common') },
      { name: '@shopgate/pwa-core', path: join(dirOne, 'pwa-core') },
      { name: '@customscope/extension-one', path: join(dirTwo, '@customscope/extension-one/frontend') },
      { name: '@shopgate/commerce-widgets', path: join(dirTwo, '@shopgate/commerce-widgets/frontend') },
      { name: 'custom-extension', path: join(dirTwo, 'custom-extension/frontend') }
    ])

    // The package "@customscope/invalid-package" contains a not well-formed package.json.
    // The PackageCollector doesn't throw an exception, but only logs a message.
    sinon.assert.calledWith(loggerStub, `${red('Error')}: Invalid package at ${join(dirTwo, '@customscope/invalid-package/frontend')}`)
  })

  it('should not collect packages when no folder is passed', () => {
    const collection = packageCollector.get()
    assert.deepEqual(collection, [])
  })
})
