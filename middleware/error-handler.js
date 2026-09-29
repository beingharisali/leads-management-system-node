const { StatusCodes } = require('http-status-codes');
const multer = require('multer');
const logger = require('../middleware/logger'); // winston logger
const { CustomAPIError } = require('../errors');

// Friendly names for fields that can hit a unique index
const DUPLICATE_FIELD_LABELS = {
    email: 'email address',
    phone: 'phone number',
};

const MULTER_MESSAGES = {
    LIMIT_FILE_SIZE: 'The file is too large. Please upload a smaller file.',
    LIMIT_UNEXPECTED_FILE: 'Unexpected file field. Please upload a single file.',
};

const errorHandlerMiddleware = (err, req, res, next) => {
    // Custom API Error - message is already written for the user
    if (err instanceof CustomAPIError) {
        logger.error(`CustomAPIError: ${err.message} | ${req.method} ${req.originalUrl}`);
        return res.status(err.statusCode).json({ msg: err.message });
    }

    let customError = {
        statusCode: err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
        // Internal error text (driver messages, stack traces) is never sent to the user
        msg: 'Something went wrong on the server. Please try again later.',
    };

    // Mongoose Validation Error
    if (err.name === 'ValidationError') {
        customError.msg = Object.values(err.errors)
            .map((item) => item.message)
            .join(', ');
        customError.statusCode = StatusCodes.BAD_REQUEST;
    }

    // Duplicate Key Error
    if (err.code && err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'value';
        const label = DUPLICATE_FIELD_LABELS[field] || field;
        const value = err.keyValue?.[field];
        customError.msg = value
            ? `An account with the ${label} "${value}" already exists. Please use a different ${label}.`
            : `This ${label} is already in use. Please use a different ${label}.`;
        customError.statusCode = StatusCodes.CONFLICT;
    }

    // Cast Error (Invalid ObjectId)
    if (err.name === 'CastError') {
        customError.msg = `No record found with id: ${err.value}`;
        customError.statusCode = StatusCodes.NOT_FOUND;
    }

    // File upload errors (size limits etc.) and our own file-type filter
    if (err instanceof multer.MulterError) {
        customError.msg = MULTER_MESSAGES[err.code] || `File upload failed: ${err.message}`;
        customError.statusCode = StatusCodes.BAD_REQUEST;
    } else if (err.isUploadError) {
        customError.msg = err.message;
        customError.statusCode = StatusCodes.BAD_REQUEST;
    }

    // Malformed JSON body
    if (err.type === 'entity.parse.failed') {
        customError.msg = 'The request data is malformed. Please try again.';
        customError.statusCode = StatusCodes.BAD_REQUEST;
    }

    logger.error(`${err.message} | ${req.method} ${req.originalUrl} | Stack: ${err.stack}`);

    return res.status(customError.statusCode).json({ msg: customError.msg });
};

module.exports = errorHandlerMiddleware;
