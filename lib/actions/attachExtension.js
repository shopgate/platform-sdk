const path = require('path')
const fsEx = require('fs-extra')
const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')

const EXTENSION_FOLDER = 'extensions'
const EXTENSION_CONFIG = 'settings.json'

/**
 * TODO
 * + Error-Handling?
 */
function attachExtension (cmd) {
  if (!UserSettings.getInstance().getSession().hasToken()) throw new Error('not logged in')

  // Throws error if not in app folder
  const settings = AppSettings.getInstance()

  // If no extension specified, add all local
  if (typeof cmd !== 'string') {
    return getExtensions(extensions => {
      extensions.forEach(extension => {
        settings.attachExtension(extension)
        console.log(`Added '${extension}'`)
      })
      settings.save()
    })
  }

  for (let i = 0; i < arguments.length - 1; i++) {
    const name = arguments[i]
    extensionExists(name, (err, exists) => {
      if (err) throw err
      if (!exists) throw new Error(`The Extension '${name}' does not exists locally!`)
      settings.attachExtension(name).save()
      console.log(`Added '${name}'`)
    })
  }
}

function extensionExists (name, cb) {
  fsEx.pathExists(path.join(EXTENSION_FOLDER, name, EXTENSION_CONFIG), cb)
}

/**
 * TODO: is it ok, to check only for folder-name?
 */
function getExtensions (cb) {
  fsEx.readdir(EXTENSION_FOLDER, (err, files) => {
    if (err) throw err

    const extensions = []
    // Read every settings.json, so that id is definetly the right one
    files.forEach(ext => {
      try {
        const json = fsEx.readJSONSync(path.join(EXTENSION_FOLDER, ext, EXTENSION_CONFIG))
        if (json.id) extensions.push(json.id)
        else console.log('Invalid Settings in ' + ext)
      } catch (err) {
        console.log('Could not read settings for ' + ext)
      }
    })
    cb(extensions)
  })
}

module.exports = attachExtension
module.exports.cmd = commander => {
  commander
    .command('attachExtension')
    .description('attaches a extension')
    .option('[extensionNames...]', 'set the Application ID you want to initialize')
    .action(attachExtension)
}
