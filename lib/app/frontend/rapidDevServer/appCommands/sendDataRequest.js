/**
 * The dataRequest command.
 * @param {Object} parameter the command parameters.
 * @param {Function} callback The API callback.
 */
module.exports = (parameter, callback) => {
  const action = parameter.src.replace('sgapi:', '')
  let responsePayload = {}

  if (action === 'pipeline_cart_add_product') {
    responsePayload = {
      success: true,
      systemMessage: null,
      validationErrors: null,
      html: null,
      data: {
        cart: {
          amount: null,
          orderable: true,
          products: [],
          coupons: [],
          productsCount: 3
        }
      }
    }
  }

  const answerCommand = {
    c: 'dataResponse',
    p: {
      pageId: parameter.src,
      serial: parameter.serial,
      status: 200,
      body: JSON.stringify(responsePayload),
      bodyContentType: 'application/json; charset=UTF-8',
      maxAge: 0
    }
  }

  callback(null, answerCommand)
}
