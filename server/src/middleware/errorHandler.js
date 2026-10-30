export const notFoundHandler = (_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
};

export const globalErrorHandler = (err, _req, res, _next) => {
  // Never expose connection string, db host, credentials or internal stack trace
  console.error('[Application Error]:', err.name, err.message);

  // MongoDB / Mongoose errors
  if (
    err.name === 'MongoError' ||
    err.name === 'MongoServerError' ||
    err.name === 'MongooseError' ||
    err.name === 'CastError'
  ) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'A record with this key already exists.' });
    }
    return res.status(500).json({ error: 'A database error occurred. Please try again later.' });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  // Client errors (4xx)
  const status = err.status || err.statusCode;
  if (status && status >= 400 && status < 500) {
    return res.status(status).json({ error: err.message || 'Invalid request' });
  }

  // Fallback generic 500 error
  res.status(500).json({ error: 'An unexpected server error occurred. Please try again later.' });
};
