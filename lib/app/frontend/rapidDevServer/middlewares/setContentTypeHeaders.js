/**
 * Reset the headers content type to force utf-8.
 * @param {Object} req The request object.
 * @param {Object} res The response object.
 * @param {Function} next Callback to delegate to the next middleware.
 */
module.exports = (req, res, next) => {
  if (req.headers['content-type']) {
    req.headers['content-type'] = req.headers['content-type'].replace('utf8', 'utf-8')
  }

  next()
}
