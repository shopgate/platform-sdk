const semver = require('semver')
const updateNotifier = require('update-notifier')

/**
 * Tells the user when a newer version of the SDK is available. It never stops the command.
 * @param {{name: string, version: string}} pkg The package.json of the SDK.
 */
module.exports = (pkg) => {
  const notifier = updateNotifier({ pkg, updateCheckInterval: 0, shouldNotifyInNpmScript: true })
  const { update } = notifier

  if (!update || !semver.valid(update.latest) || !semver.gt(update.latest, pkg.version)) return

  update.current = pkg.version
  notifier.notify({ isGlobal: true, defer: false })
}
