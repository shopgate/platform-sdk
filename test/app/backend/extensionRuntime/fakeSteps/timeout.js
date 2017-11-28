module.exports = (context, input, cb) => {
  setTimeout(() => cb(null, input), 1000)
}
