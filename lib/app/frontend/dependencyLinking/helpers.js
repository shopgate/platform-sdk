/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { join } = require('path')
const { readdirSync, statSync } = require('fs')

const childProcess = require('child_process')

/**
 * Execute a command sycronously.
 * @param {string} command The command to execute.
 * @param {string} [cwd] The working directory.
 * @param {boolean} [silent=false] Tells of the stdout shall be suppressed.
 * @return {Buffer|string} The stdout from the command.
 */
const exec = (cmd, cwd, silent = false) => childProcess.execSync(cmd, {
  ...cwd && { cwd },
  stdio: silent ? '' : 'inherit'
})

/**
 * Creates a list of subdirectories for a directory.
 * @param {string} dir The directory.
 * @param {boolean} [fullPath=true] Tells if concatenated paths shall be returned.
 * @return {Array} The subdirectories.
 */
const getSubDirectories = (dir, fullPath = true) => {
  return readdirSync(dir)
    .filter(file => statSync(join(dir, file)).isDirectory())
    .map(subDir => fullPath ? join(dir, subDir) : subDir)
}

/**
 * Searches the directory tree within a directory recusively for a spedified directory name.
 * It returns a list of all found paths.
 * @param {string} dir The directory.
 * @param {string} needle The searched directory name.
 * @param {number} [depth=2] The maximum depth within the directory tree.
 * @return {Array} The search results.
 */
const findSubDirectories = (dir, needle, depth = 2) => {
  let result = []

  // Get the subdirectories of the current root directory.
  getSubDirectories(dir, false).forEach((subDir) => {
    if (subDir === needle) {
      // Add matching directories to the results.
      result.push(join(dir, subDir))
    } else if (depth > 0) {
      // Step deeper into the directory tree if the maximum depth isn't reached yet.
      result = result.concat(findSubDirectories(join(dir, subDir), needle, depth - 1))
    }
  })

  return result
}

module.exports = {
  exec,
  getSubDirectories,
  findSubDirectories
}
