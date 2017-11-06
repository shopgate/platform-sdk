/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { join } = require('path')
const AppSettings = require('../../../AppSettings')
const Themes = require('../../Themes')

const extensions = AppSettings.getInstance().getExtensions()
const path = Themes.getCurrentTheme().path

/**
 * Returns the node modules paths to all extensions.
 * @return {Array}
 */
module.exports = () => (
  extensions.map(name => join(path, 'extensions', name, 'frontend', 'node_modules'))
)
