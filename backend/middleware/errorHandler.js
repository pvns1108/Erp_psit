function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Route not found — ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  if (err.status) statusCode = err.status;
  // Multer errors (file too large, unexpected field) are client errors, not server crashes
  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') err.message = 'File is too large';
  }
  // Duplicate key (e.g. same email / registration number) → 409 instead of a raw Mongo error
  if (err.code === 11000) {
    statusCode = 409;
    err.message = `A record with this ${Object.keys(err.keyValue || {}).join(', ') || 'value'} already exists`;
  }
  if (err.name === 'CastError') { statusCode = 400; err.message = 'Invalid ID'; }
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Server error',
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
}

module.exports = { notFound, errorHandler };
