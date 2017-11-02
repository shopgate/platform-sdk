/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const webpack = require('webpack')
const { blue, green } = require('chalk')

module.exports = [
  new webpack.HotModuleReplacementPlugin(),
  new webpack.NoEmitOnErrorsPlugin(),
  new (require('progress-bar-webpack-plugin'))({
    format: `  building [${blue(':bar')}] [:msg] ${green(':percent')} (:elapsed seconds)`,
    clear: false
  })
]
