/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { join } = require('path')
const sinon = require('sinon')
const helpers = require('../../../../lib/app/frontend/linkDependencies/helpers')

const PackageCollector = require('../../../../lib/app/frontend/linkDependencies/PackageCollector')
const DependencyLinker = require('../../../../lib/app/frontend/linkDependencies/DependencyLinker')
const { THEMES_FOLDER, PWA_FOLDER } = require('../../../../lib/app/frontend/FrontendSettings')

describe('DependencyLinker', () => {
  let dependencyLinker
  let execHelper

  beforeEach(() => {
    dependencyLinker = new DependencyLinker()
    execHelper = sinon.stub(helpers, 'exec')
  })

  afterEach(() => {
    execHelper.restore()
  })

  it('should not to anything without packages or linkable dependencies', () => {
    dependencyLinker.link()
    sinon.assert.callCount(execHelper, 0)
  })

  it('should not to anything without linkable dependencies', () => {
    const packages = new PackageCollector().get(join(__dirname, `mocks/${THEMES_FOLDER}`))

    dependencyLinker
      .link(packages)

    sinon.assert.callCount(execHelper, 0)
  })

  it('should link dependencies to the packages', () => {
    const folderOne = join(__dirname, `mocks/${THEMES_FOLDER}`)
    const folderTwo = join(__dirname, `mocks/${PWA_FOLDER}`)

    const packages = new PackageCollector().get(folderOne)
    const dependencies = new PackageCollector().get(folderTwo)

    dependencyLinker
      .setLinkableDependencies(dependencies)
      .link(packages)

    sinon.assert.callCount(execHelper, 9)
    sinon.assert.callOrder(
      execHelper.withArgs('npm link', join(folderTwo, 'pwa-common')),
      execHelper.withArgs('npm link', join(folderTwo, 'pwa-core')),
      execHelper.withArgs('npm link', join(folderTwo, 'eslint-config')),
      execHelper.withArgs('npm link @shopgate/pwa-common', join(folderOne, 'theme-gmd'), true),
      execHelper.withArgs('npm link @shopgate/pwa-core', join(folderOne, 'theme-gmd'), true),
      execHelper.withArgs('npm link @shopgate/eslint-config', join(folderOne, 'theme-gmd'), true),
      execHelper.withArgs('npm link @shopgate/pwa-common', join(folderOne, 'theme-ios11'), true),
      execHelper.withArgs('npm link @shopgate/pwa-core', join(folderOne, 'theme-ios11'), true),
      execHelper.withArgs('npm link @shopgate/eslint-config', join(folderOne, 'theme-ios11'), true)
    )
  })
})
