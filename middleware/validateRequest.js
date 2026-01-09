// middleware/validateRequest.js
const { validationResult } = require('express-validator');
const { BadRequestError } = require('../errors');

const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const messages = errors.array().map(err => err.msg);
        throw new BadRequestError(messages.join(', '));
    }
    next();
};

module.exports = validateRequest;
