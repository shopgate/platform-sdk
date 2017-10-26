const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')

function detachExtension (extensions) {
  if (!UserSettings.getInstance().getSession().hasToken()) throw new Error('not logged in')

  // Throws error if not in app folder
  const settings = AppSettings.getInstance()

  // If no extension specified, remove all from config
  if (!extensions.length) {
    settings.detachAllExtensions().save()
    return
  }

  settings.detachExtensions(extensions).save()
}

module.exports = detachExtension
module.exports.cmd = commander => {
  commander
    .command('extension detach [extensionNames...]')
    .description('detaches one or more extension')
    .action(detachExtension)
}
