module.exports = function (context, input, cb) {
  const error = new Error('crashed ' + context.meta.appId)
  Object.assign(error, input)
  cb(error)
}
