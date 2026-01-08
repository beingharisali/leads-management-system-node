// middleware/role.js

const { UnauthorizedError } = require("../errors");

const role = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            throw new UnauthorizedError("Access denied");
        }
        next();
    };
};

module.exports = role;
