const standardResponse = (req, res, next) => {
    res.sendSuccess = (data, message = "") => {
        res.status(200).json({
            success: true,
            message,
            data,
            error: null,
        });
    };

    res.sendCreated = (data, message = "") => {
        res.status(201).json({
            success: true,
            message,
            data,
            error: null,
        });
    };

    res.sendError = (error, statusCode = 400, message = "") => {
        res.status(statusCode).json({
            success: false,
            message,
            data: null,
            error: error.message || error,
        });
    };

    next();
};

module.exports = standardResponse;
