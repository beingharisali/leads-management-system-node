const { createLogger, format, transports } = require("winston");
const { combine, timestamp, printf, errors, colorize } = format;

// Custom log format
const myFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}] : ${stack || message}`;
});

const logger = createLogger({
    level: "info",
    format: combine(
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        errors({ stack: true }),
        myFormat
    ),
    transports: [
        new transports.Console({
            format: combine(colorize(), myFormat),
        }),
        new transports.File({ filename: "logs/error.log", level: "error" }),
        new transports.File({ filename: "logs/combined.log" }),
    ],
});

module.exports = logger;
