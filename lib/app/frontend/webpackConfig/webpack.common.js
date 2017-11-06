/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { resolve } = require('path')
const StringReplacePlugin = require('string-replace-webpack-plugin')
const convertLanguageToISO = require('./helpers/convertLanguageToISO')
const getExtensionsNodeModulesPaths = require('./helpers/getExtensionsNodeModulesPaths')
const AppSettings = require('../../AppSettings')
const { isDev } = require('../environment')
const themes = require('../Themes')

const appSettings = AppSettings.getInstance().getAppSettings()

const THEME_PATH = themes.getPath()
const LANG = convertLanguageToISO(appSettings.language)
const NODE_MODULES = 'node_modules'
const LOCAL_NODE_MODULES = resolve(process.env.SDK_PATH, NODE_MODULES)

const stringReplacementLoader = StringReplacePlugin.replace({
  replacements: [{
    pattern: /__PROJECT_PATH__/g,
    replacement: () => JSON.stringify(THEME_PATH)
  }]
})

module.exports = {
  context: resolve(THEME_PATH),
  devServer: {
    hot: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
    publicPath: '/',
    contentBase: resolve(THEME_PATH, 'public'),
    progress: true
  },
  entry: {
    common: [
      resolve(LOCAL_NODE_MODULES, 'babel-polyfill'),
      resolve(LOCAL_NODE_MODULES, 'intl'),
      resolve(LOCAL_NODE_MODULES, `intl/locale-data/jsonp/${LANG}.js`),
      'react',
      'react-dom',
      resolve(__dirname, './helpers/polyfill')
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
          resolve(LOCAL_NODE_MODULES, 'style-loader'),
          resolve(LOCAL_NODE_MODULES, 'css-loader')
        ]
      },
      {
        test: /\.json$/,
        use: [
          resolve(LOCAL_NODE_MODULES, 'json-loader')
        ]
      },
      {
        test: /\.svg$/,
        use: [
          resolve(LOCAL_NODE_MODULES, 'svg-inline-loader')
        ]
      },
      {
        test: /\.ejs/,
        use: [
          resolve(LOCAL_NODE_MODULES, 'ejs-loader')
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
          resolve(LOCAL_NODE_MODULES, 'cache-loader'),
          {
            loader: resolve(LOCAL_NODE_MODULES, 'babel-loader'),
            options: {
              compact: true,
              comments: !!isDev,
              sourceRoot: THEME_PATH,
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
      resolve(THEME_PATH, NODE_MODULES),
      resolve(process.env.SDK_PATH, NODE_MODULES),
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
