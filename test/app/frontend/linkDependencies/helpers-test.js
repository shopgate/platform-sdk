/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const sinon = require('sinon')
const { join } = require('path')
const assert = require('assert')
const childProcess = require('child_process')
const { EXTENSIONS_FOLDER } = require('../../../../lib/app/AppSettings')
const { THEMES_FOLDER, PWA_FOLDER } = require('../../../../lib/app/frontend/FrontendSettings')
const {
  exec,
  getSubDirectories,
  findSubDirectories
} = require('../../../../lib/app/frontend/linkDependencies/helpers')

describe('DependencyLinker helpers', () => {
  describe('exec', () => {
    let execSync

    beforeEach(() => {
      execSync = sinon.stub(childProcess, 'execSync')
    })

    afterEach(() => {
      execSync.restore()
    })

    it('should call execSync with command and stdio output', () => {
      exec('ls -al')

      sinon.assert.calledWith(execSync, 'ls -al', {
        stdio: 'inherit'
      })
    })

    it('should call execSync with command and stdio output within the test folder', () => {
      exec('ls -al', __dirname)

      sinon.assert.calledWith(execSync, 'ls -al', {
        cwd: __dirname,
        stdio: 'inherit'
      })
    })

    it('should call execSync with command and no stdio output within the test folder', () => {
      exec('ls -al', __dirname, true)

      sinon.assert.calledWith(execSync, 'ls -al', {
        cwd: __dirname,
        stdio: ''
      })
    })
  })

  describe('getSubDirectories', () => {
    it('should return subdirectories with full paths', () => {
      const dirs = getSubDirectories(join(__dirname, 'mocks'))
      assert.deepEqual(dirs, [
        join(__dirname, `mocks/${EXTENSIONS_FOLDER}`),
        join(__dirname, `mocks/${PWA_FOLDER}`),
        join(__dirname, `mocks/${THEMES_FOLDER}`)
      ])
    })

    it('should only return the subdirectories, when parameter is set', () => {
      const dirs = getSubDirectories(join(__dirname, 'mocks'), false)
      assert.deepEqual(dirs, [EXTENSIONS_FOLDER, PWA_FOLDER, THEMES_FOLDER])
    })

    it('should return an empty array if no subdirectories are available', () => {
      const dirs = getSubDirectories(join(__dirname, `mocks/${THEMES_FOLDER}/theme-gmd`), false)
      assert.deepEqual(dirs, [])
    })

    it('should throw an error for an invalid directory', () => {
      try {
        getSubDirectories(join(__dirname, `mocks/${THEMES_FOLDER}/theme-gmd/package.json`))
      } catch (err) {
        assert.equal(err.code, 'ENOTDIR')
      }
    })
  })

  describe('findSubDirectories', () => {
    it('should find three "frontend" folders within the mocked extension folder', () => {
      const dirs = findSubDirectories(join(__dirname, `mocks/${EXTENSIONS_FOLDER}`), 'frontend')
      assert.deepEqual(dirs, [
        join(__dirname, `mocks/${EXTENSIONS_FOLDER}/@customscope/extension-one/frontend`),
        join(__dirname, `mocks/${EXTENSIONS_FOLDER}/@customscope/invalid-package/frontend`),
        join(__dirname, `mocks/${EXTENSIONS_FOLDER}/@shopgate/commerce-widgets/frontend`),
        join(__dirname, `mocks/${EXTENSIONS_FOLDER}/custom-extension/frontend`)
      ])
    })

    it('should find one "frontend" folder when search depth is reduced', () => {
      const dirs = findSubDirectories(join(__dirname, `mocks/${EXTENSIONS_FOLDER}`), 'frontend', 1)
      assert.deepEqual(dirs, [
        join(__dirname, `mocks/${EXTENSIONS_FOLDER}/custom-extension/frontend`)
      ])
    })
  })
})
