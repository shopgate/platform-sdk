module.exports = function (context, input) {
  return new Promise((resolve, reject) => {
    reject(new Error('error'))
  })
}
