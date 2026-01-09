// errors/not-found.js
const CustomAPIError = require('./custom-api');
const { StatusCodes } = require('http-status-codes');

class NotFoundError extends CustomAPIError {
  constructor(message) {
    super(message, StatusCodes.NOT_FOUND);
  }
}

module.exports = NotFoundError;
