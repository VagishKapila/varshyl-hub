function errorHandler(err, req, res, next) {
  console.error('[Error Handler]', err.message);
  
  // Log the request context
  console.error(`  Route: ${req.method} ${req.path}`);
  if (req.user) console.error(`  User: ${req.user.email}`);
  if (req.product) console.error(`  Product: ${req.product.slug}`);
  
  // Default to 500
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  
  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
