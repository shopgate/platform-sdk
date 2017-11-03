/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { resolve } = require('path')
const merge = require('webpack-merge')
const common = require('./common')
const Themes = require('../../../Themes')
const plugins = require('../plugins/prod')

const currentTheme = Themes.getCurrentTheme().path

module.exports = merge(common, {
  entry: {
    app: [
      resolve(currentTheme, 'index.jsx')
    ]
  },
  devtool: 'cheap-module-source-map',
  output: {
    filename: '[name].[chunkhash].js',
    chunkFilename: '[name].[chunkhash].js',
    path: resolve(currentTheme, 'public'),
    publicPath: './'
  },
  plugins,
  stats: 'errors-only'
})
