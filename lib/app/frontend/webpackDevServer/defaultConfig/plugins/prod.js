/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const webpack = require('webpack')
const CompressionWebpackPlugin = require('compression-webpack-plugin')
const OfflinePlugin = require('offline-plugin')
const commonPlugins = require('./common')

const prodPlugins = [
  new OfflinePlugin(),
  new webpack.optimize.UglifyJsPlugin({
    compress: {
      warnings: true,
      screw_ie8: true,
      conditionals: true,
      unused: true,
      comparisons: true,
      sequences: true,
      dead_code: true,
      evaluate: true,
      if_return: true,
      join_vars: true
    },
    output: {
      comments: false
    },
    comments: false,
    sourceMap: true
  }),
  new CompressionWebpackPlugin({
    asset: '[path].gz[query]',
    algorithm: 'gzip',
    test: /\.js$|\.css$/,
    minRatio: 0.8
  })
]

const plugins = commonPlugins.concat(prodPlugins)

module.exports = plugins
