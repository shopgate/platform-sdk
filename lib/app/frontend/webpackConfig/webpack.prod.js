/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { resolve } = require('path')
const merge = require('webpack-merge')
const themes = require('../Themes')
const common = require('./webpack.common')
const plugins = require('./plugins/prod')

const THEME_PATH = themes.getPath()

module.exports = merge(common, {
  entry: {
    app: [
      resolve(THEME_PATH, 'index.jsx'),
      resolve(__dirname, './modules/cache')
    ]
  },
  devtool: 'cheap-module-source-map',
  output: {
    filename: '[name].[chunkhash].js',
    chunkFilename: '[name].[chunkhash].js',
    path: resolve(THEME_PATH, 'public'),
    publicPath: './'
  },
  plugins,
  stats: 'errors-only'
})
