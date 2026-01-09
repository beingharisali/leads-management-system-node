// middleware/async.js
const asyncWrapper = (fn) => {
    return async (req, res, next) => {
        try {
            await fn(req, res, next);
        } catch (error) {
            next(error); // ye error-handler.js ko forward karega
        }
    };
};

module.exports = asyncWrapper;
