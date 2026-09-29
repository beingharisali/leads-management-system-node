// errors/forbidden.js
const CustomAPIError = require('./custom-api');
const { StatusCodes } = require('http-status-codes');

// Logged in, but not allowed to do this (403) - unlike UnauthenticatedError
// (401), which means "not logged in / bad credentials".
class ForbiddenError extends CustomAPIError {
  constructor(message) {
    super(message, StatusCodes.FORBIDDEN);
  }
}

module.exports = ForbiddenError;
