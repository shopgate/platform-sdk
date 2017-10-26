const mock = require('./getWebStorageEntry.mock')

/**
 * The getWebStorageEntry command.
 * @param {Object} parameter the command parameters.
 * @param {Function} callback The API callback.
 */
module.exports = (parameter, callback) => {
  const name = parameter.name

  const answerCommand = {
    c: 'webStorageResponse',
    p: {
      serial: parameter.serial,
      age: null,
      value: null
    }
  }

  mock.get(name, (error, age, value) => {
    if (error) console.error(error)

    answerCommand.p.value = value
    answerCommand.p.age = age

    callback(null, answerCommand)
  })
}
