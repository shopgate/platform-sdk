/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

// const { resolve } = require('path')
// const proxyquire = require('proxyquire')

// class Themes {
//   constructor () {
//     this.themes = [
//       {
//         name: 'my-theme',
//         path: 'some/path'
//       }
//     ]
//   }

//   getCurrentTheme () {
//     return {
//       path: 'some/path'
//     }
//   }
// }

// describe('Webpack Default Config', () => {
//   before(() => {
//     // Reset some stuff
//     process.env.PWD = resolve(__dirname, '../../../')
//     console.log(process.env.PWD)
//   })

//   it('should return the dev config', () => {
//     const devConfig = proxyquire('../../../../../../lib/app/frontend/webpackDevServer/defaultConfig/config/dev', {
//       plugins: [],
//       Themes: new Themes()
//     })

//     console.log(devConfig)
//   })
// })
