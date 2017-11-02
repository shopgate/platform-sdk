/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { resolve } = require('path')
const webpack = require('webpack')
const StringReplacePlugin = require('string-replace-webpack-plugin')
const {
  ENV,
  isDev,
  isStaging,
  isProd,
  isRemote,
  projectPath
} = require('../../environment')
const { convertLanguageToISO } = require('./helpers/webpack')
const appConfig = require('./helpers/app').getAppSettings()
const { shopName } = appConfig
const { language } = appConfig
const lang = convertLanguageToISO(language || 'en-us')

const componentsConfig = require('./helpers/app').getComponentsSettings()
const { ip, port } = require('./helpers/app').getDevConfig()

const plugins = []

plugins.push(
  new StringReplacePlugin(),
  new webpack.DefinePlugin({
    'process.env': {
      NODE_ENV: JSON.stringify(ENV),
      APP_CONFIG: JSON.stringify(appConfig),
      COMPONENTS_CONFIG: JSON.stringify(componentsConfig),
      LANG: JSON.stringify(lang),
      REMOTE: JSON.stringify(isRemote),
      IP: JSON.stringify(ip),
      PORT: JSON.stringify(port)
    }
  }),
  new webpack.LoaderOptionsPlugin({
    debug: isDev,
    options: {
      context: projectPath,
      output: {
        path: resolve(projectPath, 'public')
      }
    }
  }),
  new webpack.IgnorePlugin(),
  new webpack.optimize.ModuleConcatenationPlugin(),
  new webpack.optimize.CommonsChunkPlugin({
    minChunks: 2,
    name: 'common',
    filename: (isProd || isStaging) ? '[name].[chunkhash].js' : '[name].js'
  }),
  new webpack.HashedModuleIdsPlugin()
)

plugins.push(
  new (require('html-webpack-plugin'))({
    title: shopName || '',
    filename: resolve(projectPath, 'public', 'index.html'),
    template: resolve(__dirname, 'views', 'app.ejs'),
    inject: false,
    cache: false,
    minify: false,
    showErrors: isDev,
    xhtml: true
  }),
  new (require('preload-webpack-plugin'))({
    rel: 'prefetch',
    as: 'script',
    include: 'asyncChunks'
  })
)

module.exports = plugins
