function errorHandler(err, req, res, next) {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: err.message });
}

module.exports = errorHandler;
