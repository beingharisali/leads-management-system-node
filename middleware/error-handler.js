const { StatusCodes } = require('http-status-codes');
const logger = require('../middleware/logger'); // winston logger
const { CustomAPIError } = require('../errors');

const errorHandlerMiddleware = (err, req, res, next) => {
  let customError = {
    // set default
    statusCode: err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
    msg: err.message || 'Something went wrong, try again later',
  };

  // Custom API Error
  if (err instanceof CustomAPIError) {
    logger.error(`CustomAPIError: ${err.message} | ${req.method} ${req.originalUrl}`);
    return res.status(err.statusCode).json({ msg: err.message });
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    customError.msg = Object.values(err.errors)
      .map((item) => item.message)
      .join(', ');
    customError.statusCode = 400;
  }

  // Duplicate Key Error
  if (err.code && err.code === 11000) {
    customError.msg = `Duplicate value entered for ${Object.keys(err.keyValue)} field, please choose another value`;
    customError.statusCode = 400;
  }

  // Cast Error (Invalid ObjectId)
  if (err.name === 'CastError') {
    customError.msg = `No item found with id: ${err.value}`;
    customError.statusCode = 404;
  }

  // Log error
  logger.error(`${customError.msg} | ${req.method} ${req.originalUrl} | Stack: ${err.stack}`);

  return res.status(customError.statusCode).json({ msg: customError.msg });
};

module.exports = errorHandlerMiddleware;
