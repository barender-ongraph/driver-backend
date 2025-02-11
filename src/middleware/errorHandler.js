function errorHandler(err, req, res, next) {
  console.error(err.stack);

  // Prisma error handling
  if (err.name === 'PrismaClientKnownRequestError') {
    switch (err.code) {
      case 'P2002':
        return res.status(409).json({
          message: 'A unique constraint would be violated.',
          field: err.meta?.target?.[0]
        });
      case 'P2025':
        return res.status(404).json({
          message: 'Record not found.'
        });
      default:
        return res.status(400).json({
          message: 'Database error occurred.',
          code: err.code
        });
    }
  }

  // JWT error handling
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: 'Invalid token.'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      message: 'Token expired.'
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation error.',
      errors: err.errors
    });
  }

  // Default error
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

module.exports = errorHandler; 