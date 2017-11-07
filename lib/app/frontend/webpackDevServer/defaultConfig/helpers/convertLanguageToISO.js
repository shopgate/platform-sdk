/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const languageFormat = /^('[a-z]{2}-[a-z]{2}')$/

/**
 * Converts a lowercase language key to ISO conform lower-uppercase.
 * Returns the key unchanged when is not given in correct format.
 * @param {string} language The received language.
 * @return {string} The converted language.
 */
module.exports = (language) => {
  if (!languageFormat.test(`'${language}'`)) {
    return language
  }

  const elements = language.split('-')
  return `${elements[0]}-${elements[1].toUpperCase()}`
}
