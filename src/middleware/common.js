/**
 * Common middleware functions
 */

// Configure SSL verification
const configureSsl = () => {
  const rejectUnauthorized = process.env.REJECT_UNAUTHORIZED !== 'false';
  if (!rejectUnauthorized) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    console.log('SSL certificate verification: disabled');
    console.log('Warning: SSL certificate verification is disabled. Set REJECT_UNAUTHORIZED=true for production.');
  } else {
    console.log('SSL certificate verification: enabled');
  }
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
};

module.exports = {
  configureSsl,
  errorHandler,
  requestLogger
};