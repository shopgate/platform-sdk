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
const { isDev } = require('../../environment')

const themePath = Themes.getCurrentTheme().path
const lang = convertLanguageToISO(AppSettings.getInstance().getAppSettings().language || DEFAULT_LANG)

const stringReplacementLoader = StringReplacePlugin.replace({
  replacements: [{
    pattern: /__PROJECT_PATH__/g,
    replacement: () => JSON.stringify(themePath)
  }]
})

const config = {
  context: resolve(themePath),
  devServer: {
    hot: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
    publicPath: '/',
    contentBase: resolve(themePath, 'public'),
    progress: true
  },
  entry: {
    common: [
      resolve(process.env.SDK_PATH, 'node_modules', 'babel-polyfill'),
      resolve(process.env.SDK_PATH, 'node_modules', 'intl'),
      resolve(process.env.SDK_PATH, 'node_modules', `intl/locale-data/jsonp/${lang}.js`),
      'react',
      'react-dom',
      resolve(__dirname, '../helpers/polyfill')
    ]
  },
  externals: {
    cheerio: 'window',
    'react/lib/ExecutionEnvironment': true,
    'react/lib/ReactContext': true
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
        test: /\.svg$/,
        use: [
          resolve(process.env.SDK_PATH, 'node_modules', 'svg-inline-loader')
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
          resolve(process.env.SDK_PATH),
          resolve(process.env.SDK_PATH, 'bin')
        ],
        use: [
          stringReplacementLoader,
          resolve(process.env.SDK_PATH, 'node_modules', 'cache-loader'),
          {
            loader: resolve(process.env.SDK_PATH, 'node_modules', 'babel-loader'),
            options: {
              compact: true,
              comments: !!isDev,
              sourceRoot: themePath,
              cacheDirectory: !isDev
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
  performance: {
    hints: false
  },
  target: 'web',
  watchOptions: {
    ignored: /node_modules\b(?!\/@shopgate)\b.*/
  }
}

module.exports = config
