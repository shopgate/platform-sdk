const proxyquire = require('proxyquire')

const dirs = []
let files = []

const stub = {
  emptyDirSync: (dir) => {
    if (dirs.includes(dir)) {
      files = files.map(entry => {
        return (!entry.startsWith(dir))
      })
    }
    return true
  }
}

module.exports = {
  stub: function (target) {
    return proxyquire(target, {
      'fs-extra': stub
    })
  },
  overrides: stub
}