/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Converts a lowercase language key to ISO conform lower-uppercase.
 * @param {string} language The received language.
 * @return {string} The converted language.
 */
module.exports = (language) => {
  const elements = language.split('-')
  return `${elements[0]}-${elements[1].toUpperCase()}`
}
