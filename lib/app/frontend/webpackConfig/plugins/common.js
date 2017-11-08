/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { resolve } = require('path')
const { blue, green } = require('chalk')
const webpack = require('webpack')
const HTMLWebpackPlugin = require('html-webpack-plugin')
const StringReplacePlugin = require('string-replace-webpack-plugin')
const ProgressBarWebpackPlugin = require('progress-bar-webpack-plugin')
const AppSettings = require('../../../AppSettings')
const themes = require('../../Themes')
const convertLanguageToISO = require('../helpers/convertLanguageToISO')
const { ENV, isDev, isProd } = require('../../environment')

const appSettings = AppSettings.getInstance()
const appConfig = appSettings.getAppSettings()
const frontendSettings = appSettings.getFrontendSettings()
const componentsConfig = appSettings.getComponentsSettings()

const THEME_PATH = themes.getPath()
const THEME_NAME = themes.getName()
const PUBLIC_FOLDER = 'public'
const LANG = convertLanguageToISO(appConfig.language)

const plugins = [
  new StringReplacePlugin(),
  new HTMLWebpackPlugin({
    title: appConfig.shopName || THEME_NAME,
    filename: resolve(THEME_PATH, PUBLIC_FOLDER, 'index.html'),
    template: resolve(__dirname, '../templates/index.ejs'),
    inject: false,
    cache: false,
    minify: false
  }),
  new webpack.DefinePlugin({
    'process.env': {
      NODE_ENV: JSON.stringify(ENV),
      APP_CONFIG: JSON.stringify({
        ...appConfig,
        appId: appConfig.id
      }),
      COMPONENTS_CONFIG: JSON.stringify(componentsConfig),
      LANG: JSON.stringify(LANG),
      IP: JSON.stringify(frontendSettings.getIpAddress()),
      PORT: JSON.stringify(frontendSettings.getApiPort())
    }
  }),
  new webpack.LoaderOptionsPlugin({
    debug: isDev,
    options: {
      context: THEME_PATH,
      output: {
        path: resolve(THEME_PATH, PUBLIC_FOLDER)
      }
    }
  }),
  new webpack.IgnorePlugin(),
  new webpack.optimize.ModuleConcatenationPlugin(),
  new webpack.optimize.CommonsChunkPlugin({
    minChunks: 2,
    name: 'common',
    filename: isProd ? '[name].[chunkhash].js' : '[name].js'
  }),
  new webpack.HashedModuleIdsPlugin(),
  new ProgressBarWebpackPlugin({
    format: `  building [${blue(':bar')}] [:msg] ${green(':percent')} (:elapsed seconds)`,
    clear: false
  })
]

module.exports = plugins
