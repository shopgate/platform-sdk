/**
 * Logs an error to the console.
 * @param {Object|string} err The error.
 * @param {Object} req The request object.
 * @param {Object} res The response object.
 * @param {Function} next Pass over to the next middleware.
 */
module.exports = (err, req, res, next) => {
  if (!err) {
    next()
  }

  console.error(err.stack)
  next(err)
}
