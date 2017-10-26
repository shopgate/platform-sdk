/**
 * Sets the cross origin headers to allow all origins.
 * @param {Object} req The request object.
 * @param {Object} res The response object.
 * @param {Function} next Callback to delegate to the next middleware.
 */
module.exports = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
}
