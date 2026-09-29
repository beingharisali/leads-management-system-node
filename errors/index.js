// errors/index.js
const CustomAPIError = require('./custom-api');
const BadRequestError = require('./bad-request');
const UnauthenticatedError = require('./unauthenticated');
const NotFoundError = require('./not-found');
const ForbiddenError = require('./forbidden');

module.exports = {
  CustomAPIError,
  BadRequestError,
  UnauthenticatedError,
  NotFoundError,
  ForbiddenError,
};
