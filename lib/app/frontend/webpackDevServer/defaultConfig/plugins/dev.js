/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const webpack = require('webpack')
const { blue, green } = require('chalk')
const ProgressBarWebpackPlugin = require('progress-bar-webpack-plugin')
const commonPlugins = require('./common')

const devPlugins = [
  new webpack.HotModuleReplacementPlugin(),
  new webpack.NoEmitOnErrorsPlugin(),
  new ProgressBarWebpackPlugin({
    format: `  building [${blue(':bar')}] [:msg] ${green(':percent')} (:elapsed seconds)`,
    clear: false
  })
]

const plugins = commonPlugins.concat(devPlugins)

module.exports = plugins
