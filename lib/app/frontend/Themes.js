/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const getThemes = require('../helpers/getThemes')
const find = require('lodash/find')

class Themes {
  /**
   * @param {Object} themes The frontend themes
   */
  constructor () {
    this.currentTheme = null
    this.themes = getThemes()
  }

  getCurrentTheme () {
    const theme = find(this.themes, {name: this.currentTheme})
    return theme
  }

  getThemes () {
    return this.themes
  }

  setCurrentTheme (name) {
    this.currentTheme = name
    return this
  }
}

module.exports = new Themes()
