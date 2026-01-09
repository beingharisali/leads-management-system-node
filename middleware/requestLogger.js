const fs = require('fs');
const path = require('path');
const morgan = require('morgan');

// Log file path
const logFilePath = path.join(__dirname, '../logs/requests.log');

// Ensure logs folder exists
if (!fs.existsSync(path.join(__dirname, '../logs'))) {
    fs.mkdirSync(path.join(__dirname, '../logs'));
}

// Create a write stream in append mode
const accessLogStream = fs.createWriteStream(logFilePath, { flags: 'a' });

// Morgan setup: log to console + file
const requestLogger = morgan(
    ':method :url :status :res[content-length] - :response-time ms',
    {
        stream: accessLogStream,
    }
);

module.exports = requestLogger;
