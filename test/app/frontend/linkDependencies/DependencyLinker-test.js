/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { join } = require('path')
const sinon = require('sinon')
const helpers = require('../../../../lib/app/frontend/dependencyLinking/helpers')
const logger = require('../../../../lib/logger')
const PackageCollector = require('../../../../lib/app/frontend/dependencyLinking/PackageCollector')
const DependencyLinker = require('../../../../lib/app/frontend/dependencyLinking/DependencyLinker')
const { THEMES_FOLDER, PWA_FOLDER } = require('../../../../lib/app/frontend/FrontendSettings')

describe('DependencyLinker', () => {
  let dependencyLinker
  let execHelperStub
  let loggerStub

  beforeEach(() => {
    dependencyLinker = new DependencyLinker()
    execHelperStub = sinon.stub(helpers, 'exec')
    loggerStub = sinon.stub(logger, 'plain')
  })

  afterEach(() => {
    execHelperStub.restore()
    loggerStub.restore()
  })

  it('should not to anything without packages or linkable dependencies', () => {
    dependencyLinker.link()
    sinon.assert.callCount(execHelperStub, 0)
  })

  it('should not to anything without linkable dependencies', () => {
    const packages = new PackageCollector().get(join(__dirname, `mocks/${THEMES_FOLDER}`))

    dependencyLinker
      .link(packages)

    sinon.assert.callCount(execHelperStub, 0)
  })

  it('should link dependencies to the packages', () => {
    const dependenciesFolder = join(__dirname, `mocks/${PWA_FOLDER}`)
    const themesFolder = join(__dirname, `mocks/${THEMES_FOLDER}`)

    const dependencies = new PackageCollector().get(dependenciesFolder)
    const packages = new PackageCollector().get(themesFolder)

    dependencyLinker
      .setLinkableDependencies(dependencies)
      .link(packages)

    sinon.assert.callCount(execHelperStub, 9)
    sinon.assert.callOrder(
      execHelperStub.withArgs('npm link', join(dependenciesFolder, 'pwa-common')),
      execHelperStub.withArgs('npm link', join(dependenciesFolder, 'pwa-core')),
      execHelperStub.withArgs('npm link', join(dependenciesFolder, 'eslint-config')),
      execHelperStub.withArgs('npm link @shopgate/pwa-common', join(themesFolder, 'theme-gmd'), true),
      execHelperStub.withArgs('npm link @shopgate/pwa-core', join(themesFolder, 'theme-gmd'), true),
      execHelperStub.withArgs('npm link @shopgate/eslint-config', join(themesFolder, 'theme-gmd'), true),
      execHelperStub.withArgs('npm link @shopgate/pwa-common', join(themesFolder, 'theme-ios11'), true),
      execHelperStub.withArgs('npm link @shopgate/pwa-core', join(themesFolder, 'theme-ios11'), true),
      execHelperStub.withArgs('npm link @shopgate/eslint-config', join(themesFolder, 'theme-ios11'), true)
    )
  })
})
