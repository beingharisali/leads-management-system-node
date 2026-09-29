
const notFound = (req, res) =>
    res.status(404).json({ msg: `Route not found: ${req.method} ${req.originalUrl}` })

module.exports = notFound
