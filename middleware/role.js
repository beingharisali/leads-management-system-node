// middleware/role.js
const { UnauthenticatedError } = require("../errors");

const role = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            throw new UnauthenticatedError("Access denied");
        }
        next();
    };
};

module.exports = role;
