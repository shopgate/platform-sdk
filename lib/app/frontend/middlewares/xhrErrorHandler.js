/**
 * Returns and error statement inside an XHR request.
 * @param {Object|string} err The error.
 * @param {Object} req The request object.
 * @param {Object} res The response object.
 * @param {Function} next Pass over to the next middleware.
 */
module.exports = (err, req, res, next) => {
  if (!err) {
    next()
  }

  if (req.xhr) {
    res.status(500).send({
      status: 500,
      message: 'Something failed!',
      error: err.stack
    })
  } else {
    next(err)
  }
}
