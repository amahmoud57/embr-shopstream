const express = require('express');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.use(express.json());

// API routes
app.use('/', require('./routes/health'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/vendors', require('./routes/vendors'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/analytics', require('./routes/analytics'));

// Serve static build output (for production / local preview)
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res, next) => {
  // Only serve index.html for non-API, non-file requests (SPA fallback)
  if (req.path.startsWith('/api') || req.path === '/health') return next();
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ShopStream running on port ${PORT}`);
  console.log(`Database: ${process.env.DATABASE_URL ? 'connected' : 'no DATABASE_URL set'}`);
});
