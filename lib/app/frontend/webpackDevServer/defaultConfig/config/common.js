/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { resolve } = require('path')
const StringReplacePlugin = require('string-replace-webpack-plugin')
const convertLanguageToISO = require('../helpers/convertLanguageToISO')
const getExtensionsNodeModulesPaths = require('../helpers/getExtensionsNodeModulesPaths')
const { DEFAULT_LANG } = require('../constants')
const AppSettings = require('../../../../AppSettings')
const Themes = require('../../../Themes')

const themePath = Themes.getCurrentTheme().path
const lang = convertLanguageToISO(AppSettings.getInstance().getAppSettings().language || DEFAULT_LANG)

const stringReplacementLoader = StringReplacePlugin.replace({
  replacements: [{
    pattern: /__PROJECT_PATH__/g,
    replacement: () => JSON.stringify(themePath)
  }]
})

const config = {
  context: themePath,
  entry: {
    common: [
      resolve(themePath, 'node_modules', 'babel-polyfill'),
      resolve(themePath, 'node_modules', 'intl'),
      resolve(themePath, 'node_modules', `intl/locale-data/jsonp/${lang}.js`),
      'react',
      'react-dom',
      resolve(__dirname, '../helpers/polyfill')
    ]
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          resolve(process.env.SDK_PATH, 'node_modules', 'style-loader'),
          resolve(process.env.SDK_PATH, 'node_modules', 'css-loader')
        ]
      },
      {
        test: /\.json$/,
        use: [
          resolve(process.env.SDK_PATH, 'node_modules', 'json-loader')
        ]
      },
      {
        test: /\.ejs/,
        use: [
          resolve(process.env.SDK_PATH, 'node_modules', 'ejs-loader')
        ]
      },
      {
        test: /\.(js|jsx)$/,
        exclude: [
          resolve(process.env.SDK_PATH, 'server'),
          resolve(process.env.SDK_PATH, 'bin')
        ],
        use: [
          stringReplacementLoader,
          resolve(process.env.SDK_PATH, 'node_modules', 'cache-loader'),
          {
            loader: resolve(process.env.SDK_PATH, 'node_modules', 'babel-loader'),
            options: {
              compact: true,
              comments: false, // TODO: base on dev mode
              sourceRoot: themePath,
              cacheDirectory: false // TODO: base on dev mode
            }
          }
        ]
      }
    ]
  },
  resolve: {
    extensions: ['.json', '.js', '.jsx'],
    modules: [
      resolve(themePath, 'node_modules'),
      resolve(process.env.SDK_PATH, 'node_modules'),
      ...getExtensionsNodeModulesPaths()
    ]
  },
  // plugins,
  target: 'web',
  performance: {
    hints: false
  },
  externals: {
    cheerio: 'window',
    'react/lib/ExecutionEnvironment': true,
    'react/lib/ReactContext': true
  },
  devServer: {
    hot: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
    progress: true
  },
  watchOptions: {
    ignored: /node_modules\b(?!\/@shopgate)\b.*/
  }
}

module.exports = config
