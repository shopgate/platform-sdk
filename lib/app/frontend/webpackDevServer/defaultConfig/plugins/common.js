/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { resolve } = require('path')
const webpack = require('webpack')
const HTMLWebpackPlugin = require('html-webpack-plugin')
const PreloadWebpackPlugin = require('preload-webpack-plugin')
const StringReplacePlugin = require('string-replace-webpack-plugin')
const AppSettings = require('../../../../AppSettings')
const Themes = require('../../../Themes')
const convertLanguageToISO = require('../helpers/convertLanguageToISO')
const { ENV, isDev, isProd } = require('../../environment')

const appConfig = AppSettings.getInstance().getAppSettings()
const componentsConfig = AppSettings.getInstance().getComponentsSettings()
const currentTheme = Themes.getCurrentTheme()
const lang = convertLanguageToISO(appConfig.language || 'en-us')

const plugins = [
  new StringReplacePlugin(),
  new HTMLWebpackPlugin({
    title: appConfig.shopName || currentTheme.name,
    filename: resolve(currentTheme.path, 'public', 'index.html'),
    template: resolve(__dirname, '../template.ejs'),
    inject: false,
    cache: false,
    minify: false
  }),
  new PreloadWebpackPlugin({
    rel: 'prefetch',
    as: 'script',
    include: 'asyncChunks'
  }),
  new webpack.DefinePlugin({
    'process.env': {
      NODE_ENV: JSON.stringify(ENV),
      APP_CONFIG: JSON.stringify(appConfig),
      COMPONENTS_CONFIG: JSON.stringify(componentsConfig),
      LANG: JSON.stringify(lang),
      IP: JSON.stringify(process.env.optionsHost),
      PORT: JSON.stringify(process.env.optionsPort)
    }
  }),
  new webpack.LoaderOptionsPlugin({
    debug: isDev,
    options: {
      context: currentTheme.path,
      output: {
        path: resolve(currentTheme.path, 'public')
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
  new webpack.HashedModuleIdsPlugin()
]

module.exports = plugins
