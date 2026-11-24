const notFound = (req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  let status = error.statusCode || error.status || 500;
  let message = error.message || 'Server error';

  if (error.name === 'ValidationError') {
    status = 400;
    message = Object.values(error.errors).map((item) => item.message).join(', ');
  } else if (error.code === 11000) {
    status = 409;
    message = 'A record with that value already exists';
  } else if (error.name === 'CastError') {
    status = 400;
    message = 'Invalid record identifier';
  }

  if (status === 500) console.error(error);
  res.status(status).json({ message });
};

module.exports = { notFound, errorHandler };
