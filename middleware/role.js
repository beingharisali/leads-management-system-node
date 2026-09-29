// middleware/role.js
const { ForbiddenError } = require("../errors");

const role = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            throw new ForbiddenError("You do not have permission to perform this action.");
        }
        next();
    };
};

module.exports = role;