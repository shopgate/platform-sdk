/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const assert = require('assert')
const convertLanguageToISO = require('../../../../../../lib/app/frontend/webpackDevServer/defaultConfig/helpers/convertLanguageToISO')

describe('convertLanguageToISO', () => {
  it('should return a transformed language code', () => {
    const lang = convertLanguageToISO('en-us')
    assert.equal(lang, 'en-US')
  })

  it('should return an untransformed code when code is invalid', () => {
    const lang = convertLanguageToISO('wrong')
    assert.equal(lang, 'wrong')
  })
})
