/**
 * Returns and error statement inside an request.
 * @param {Object} req The request object.
 * @param {Object} res The response object.
 * @param {Object|string} err The error.
 * @param {Function} next Pass over to the next middleware.
 */
module.exports = (req, res, err, next) => {
  if (!err) {
    next()
  }
  if (!req.xhr) {
    console.error(err)
    return next()
  }

  res.json(500, {
    status: 500,
    message: 'Something failed!',
    error: err.stack
  })

  next(false)
}
