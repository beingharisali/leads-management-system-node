// middleware/leadValidator.js
const { body, param, query } = require('express-validator');

const createLeadValidator = [
    body('name').notEmpty().withMessage('Name is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('course').notEmpty().withMessage('Course is required'),
    body('assignedTo').optional().isMongoId().withMessage('assignedTo must be a valid ID'),
];

const updateLeadValidator = [
    param('id').isMongoId().withMessage('Invalid Lead ID'),
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('phone').optional().notEmpty().withMessage('Phone cannot be empty'),
    body('course').optional().notEmpty().withMessage('Course cannot be empty'),
];

const getLeadsByDateValidator = [
    query('filter')
        .notEmpty()
        .withMessage('Filter is required')
        .isIn(['day', 'week', 'month'])
        .withMessage('Filter must be day, week, or month'),
];

module.exports = {
    createLeadValidator,
    updateLeadValidator,
    getLeadsByDateValidator,
};
