/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { join } = require('path')
const assert = require('assert')
const PackageCollector = require('../../../../lib/app/frontend/linkDependencies/PackageCollector')
const PackageParser = require('../../../../lib/app/frontend/linkDependencies/PackageParser')
const { THEMES_FOLDER, PWA_FOLDER } = require('../../../../lib/app/frontend/FrontendSettings')

describe('PackageParser', () => {
  let packageParser

  describe('defaults', () => {
    beforeEach(() => {
      packageParser = new PackageParser().parse(join(__dirname, `mocks/${THEMES_FOLDER}/theme-gmd`))
    })

    it('should contain the expected name', () => {
      assert.equal(packageParser.getName(), '@shopgate/theme-gmd')
    })

    it('should return linkable dependencies, if none where set', () => {
      const dir = join(__dirname, `mocks/${PWA_FOLDER}`)
      const dependencies = new PackageCollector().get(dir)

      packageParser.setLinkableDependencies(dependencies)

      assert.deepEqual(packageParser.getLinkableDependencies(), [
        { name: '@shopgate/pwa-common', path: join(dir, 'pwa-common') },
        { name: '@shopgate/pwa-core', path: join(dir, 'pwa-core') },
        { name: '@shopgate/eslint-config', path: join(dir, 'eslint-config') }
      ])
    })

    it('should not return linkable dependencies, if none where set', () => {
      assert.deepEqual(packageParser.getLinkableDependencies(), [])
    })
  })

  describe('errors', () => {
    beforeEach(() => {
      packageParser = new PackageParser()
    })

    it('should throw an error when trying to parse an invalid package.json', () => {
      const dir = join(__dirname)
      try {
        packageParser.parse(dir)
      } catch (err) {
        assert.equal(err.message, `Invalid package at ${dir}`)
      }
    })

    it('should throw an error when getting package name without initialization', () => {
      try {
        packageParser.getName()
      } catch (err) {
        assert.equal(err.message, 'PackageParser not initialized')
      }
    })

    it('should throw an error when getting dependencies without initialization', () => {
      try {
        packageParser.getLinkableDependencies()
      } catch (err) {
        assert.equal(err.message, 'PackageParser not initialized')
      }
    })
  })
})
