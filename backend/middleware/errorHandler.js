const mongoose = require('mongoose');
const { HttpError } = require('../utils/httpError');

function notFoundHandler(req, res) {
  res.status(404).json({ message: 'Not found' });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ message: 'Invalid identifier' });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: 'Validation failed', errors });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: 'Duplicate key constraint' });
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: 'Invalid JSON body' });
  }

  console.error(err);
  const isDev = process.env.NODE_ENV !== 'production';
  return res.status(500).json({
    message: 'Internal server error',
    ...(isDev && { detail: err.message }),
  });
}

module.exports = { notFoundHandler, errorHandler };
