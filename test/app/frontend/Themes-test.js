/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { join } = require('path')
process.env.PWD = join(process.env.PWD, 'test/app/frontend')

const assert = require('assert')
const sinon = require('sinon')
const Themes = require('../../../lib/app/frontend/Themes')

const logger = {
  plain: sinon.spy()
}

const themes = [
  {
    name: 'theme1',
    path: join(process.env.PWD, './themes/theme1'),
    config: join(process.env.PWD, './themes/theme1/webpack.config.js')
  },
  {
    name: 'theme2',
    path: join(process.env.PWD, './themes/theme2'),
    config: join(process.env.PWD, '../../../lib/app/frontend/webpackDevServer/defaultConfig/index.js')
  }
]

describe('Themes', () => {
  afterEach(() => {
    logger.plain.reset()
  })

  it('should return all themes', () => {
    const allThemes = Themes.getThemes()
    assert.deepEqual(allThemes, themes)
  })

  it('should set the current theme', () => {
    const spy = sinon.spy(Themes, 'setCurrentTheme')
    Themes.setCurrentTheme('theme1')
    sinon.assert.calledOnce(spy)
  })

  it('should get the current theme', () => {
    const currentTheme = Themes.getCurrentTheme()
    assert.equal(themes[0].name, currentTheme.name)
  })
})
