export function notFound(req, res, next) {
  res.status(404).json({ message: 'Not Found' });
}

export function errorHandler(err, req, res, next) {
  console.error('Error handler:', err);
  console.error('Error name:', err.name);
  console.error('Error code:', err.code);
  console.error('Error message:', err.message);
  
  // Multer errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        message: 'File too large', 
        error: 'File size exceeds 10MB limit' 
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        message: 'Too many files', 
        error: 'Maximum 10 files allowed' 
      });
    }
    return res.status(400).json({ 
      message: 'File upload error', 
      error: err.message || 'Failed to process files' 
    });
  }
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ 
      message: 'Validation error', 
      errors 
    });
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({ 
      message: `${field} already exists` 
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  
  // Default error
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Server Error';
  
  res.status(status).json({ 
    message,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}


