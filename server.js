const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('azure')
    ? { rejectUnauthorized: false }
    : (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : false),
  max: 20,
  idleTimeoutMillis: 30000,
});

// Health check
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS time, current_database() AS db');
    res.json({ status: 'healthy', ...result.rows[0] });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

// Dashboard stats
app.get('/api/dashboard', async (req, res) => {
  try {
    const [revenue, orderCount, customerCount, productCount, topVendors, recentOrders, ordersByStatus] = await Promise.all([
      pool.query('SELECT COALESCE(SUM(total_cents), 0) AS total FROM orders'),
      pool.query('SELECT COUNT(*) AS count FROM orders'),
      pool.query('SELECT COUNT(*) AS count FROM customers'),
      pool.query('SELECT COUNT(*) AS count FROM products WHERE is_active = TRUE'),
      pool.query(`
        SELECT v.id, v.name, v.slug, v.rating,
               COUNT(DISTINCT p.id) AS product_count,
               COALESCE(SUM(oi.total_cents), 0) AS revenue
        FROM vendors v
        LEFT JOIN products p ON p.vendor_id = v.id
        LEFT JOIN order_items oi ON oi.vendor_id = v.id
        GROUP BY v.id ORDER BY revenue DESC LIMIT 5
      `),
      pool.query(`
        SELECT o.id, o.status, o.total_cents, o.created_at,
               c.first_name, c.last_name,
               (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count
        FROM orders o JOIN customers c ON c.id = o.customer_id
        ORDER BY o.created_at DESC LIMIT 10
      `),
      pool.query(`
        SELECT status, COUNT(*) AS count FROM orders GROUP BY status ORDER BY count DESC
      `),
    ]);
    res.json({
      revenue_cents: parseInt(revenue.rows[0].total),
      order_count: parseInt(orderCount.rows[0].count),
      customer_count: parseInt(customerCount.rows[0].count),
      product_count: parseInt(productCount.rows[0].count),
      top_vendors: topVendors.rows,
      recent_orders: recentOrders.rows,
      orders_by_status: ordersByStatus.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Products (paginated, searchable, filterable)
app.get('/api/products', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 24);
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const sort = req.query.sort || 'created_at';
    const order = req.query.order === 'asc' ? 'ASC' : 'DESC';

    const conditions = ['p.is_active = TRUE'];
    const params = [];
    let paramIdx = 1;

    if (search) {
      conditions.push(`(p.name ILIKE $${paramIdx} OR p.description ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (category) {
      conditions.push(`p.category_id = $${paramIdx}`);
      params.push(parseInt(category));
      paramIdx++;
    }

    const sortColumn = {
      price: 'p.price_cents', rating: 'p.rating_avg', name: 'p.name',
      newest: 'p.created_at', created_at: 'p.created_at',
    }[sort] || 'p.created_at';

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countQ = await pool.query(`SELECT COUNT(*) FROM products p ${where}`, params);
    const total = parseInt(countQ.rows[0].count);

    const rows = await pool.query(`
      SELECT p.*, v.name AS vendor_name, v.slug AS vendor_slug,
             cat.name AS category_name, cat.icon AS category_icon
      FROM products p
      JOIN vendors v ON v.id = p.vendor_id
      JOIN categories cat ON cat.id = p.category_id
      ${where}
      ORDER BY ${sortColumn} ${order}
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `, [...params, limit, offset]);

    res.json({ products: rows.rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single product with reviews
app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await pool.query(`
      SELECT p.*, v.name AS vendor_name, v.slug AS vendor_slug,
             cat.name AS category_name, cat.icon AS category_icon
      FROM products p
      JOIN vendors v ON v.id = p.vendor_id
      JOIN categories cat ON cat.id = p.category_id
      WHERE p.id = $1
    `, [id]);
    if (!product.rows.length) return res.status(404).json({ error: 'Product not found' });

    const reviews = await pool.query(`
      SELECT r.*, c.first_name, c.last_name
      FROM reviews r JOIN customers c ON c.id = r.customer_id
      WHERE r.product_id = $1 ORDER BY r.created_at DESC LIMIT 20
    `, [id]);

    res.json({ product: product.rows[0], reviews: reviews.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Categories
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY parent_id NULLS FIRST, name');
    res.json({ categories: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Vendors
app.get('/api/vendors', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.*, COUNT(p.id) AS product_count
      FROM vendors v LEFT JOIN products p ON p.vendor_id = v.id AND p.is_active = TRUE
      GROUP BY v.id ORDER BY v.name
    `);
    res.json({ vendors: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Vendor detail
app.get('/api/vendors/:id', async (req, res) => {
  try {
    const vendor = await pool.query('SELECT * FROM vendors WHERE id = $1', [req.params.id]);
    if (!vendor.rows.length) return res.status(404).json({ error: 'Vendor not found' });

    const products = await pool.query(`
      SELECT p.*, cat.name AS category_name
      FROM products p JOIN categories cat ON cat.id = p.category_id
      WHERE p.vendor_id = $1 AND p.is_active = TRUE
      ORDER BY p.created_at DESC LIMIT 50
    `, [req.params.id]);

    res.json({ vendor: vendor.rows[0], products: products.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Orders (paginated)
app.get('/api/orders', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const status = req.query.status || '';

    let where = '';
    const params = [];
    if (status) {
      where = 'WHERE o.status = $1';
      params.push(status);
    }

    const countQ = await pool.query(`SELECT COUNT(*) FROM orders o ${where}`, params);
    const total = parseInt(countQ.rows[0].count);

    const paramOff = params.length;
    const rows = await pool.query(`
      SELECT o.*, c.first_name, c.last_name, c.email,
             (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count
      FROM orders o JOIN customers c ON c.id = o.customer_id
      ${where}
      ORDER BY o.created_at DESC
      LIMIT $${paramOff + 1} OFFSET $${paramOff + 2}
    `, [...params, limit, offset]);

    res.json({ orders: rows.rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Order detail
app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await pool.query(`
      SELECT o.*, c.first_name, c.last_name, c.email
      FROM orders o JOIN customers c ON c.id = o.customer_id
      WHERE o.id = $1
    `, [req.params.id]);
    if (!order.rows.length) return res.status(404).json({ error: 'Order not found' });

    const items = await pool.query(`
      SELECT oi.*, p.name AS product_name, p.slug AS product_slug, v.name AS vendor_name
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      JOIN vendors v ON v.id = oi.vendor_id
      WHERE oi.order_id = $1
    `, [req.params.id]);

    res.json({ order: order.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create order
app.post('/api/orders', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customer_id, items } = req.body;
    if (!customer_id || !items || !items.length) {
      return res.status(400).json({ error: 'customer_id and items are required' });
    }

    let subtotal = 0;
    const resolvedItems = [];
    for (const item of items) {
      const prod = await client.query(
        'SELECT id, vendor_id, price_cents, stock_qty FROM products WHERE id = $1 AND is_active = TRUE',
        [item.product_id]
      );
      if (!prod.rows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Product ${item.product_id} not found` });
      }
      const p = prod.rows[0];
      const qty = Math.max(1, item.quantity || 1);
      if (p.stock_qty < qty) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Insufficient stock for product ${p.id}` });
      }
      const lineTot = p.price_cents * qty;
      subtotal += lineTot;
      resolvedItems.push({ product_id: p.id, vendor_id: p.vendor_id, quantity: qty, unit_price_cents: p.price_cents, total_cents: lineTot });
    }

    const tax = Math.round(subtotal * 0.08);
    const shipping = subtotal > 5000 ? 0 : 599;
    const total = subtotal + tax + shipping;

    const orderRes = await client.query(
      `INSERT INTO orders (customer_id, status, subtotal_cents, tax_cents, shipping_cents, total_cents, shipping_address)
       VALUES ($1, 'confirmed', $2, $3, $4, $5, '123 Demo Street, Anytown, US 12345') RETURNING *`,
      [customer_id, subtotal, tax, shipping, total]
    );
    const order = orderRes.rows[0];

    for (const item of resolvedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, vendor_id, quantity, unit_price_cents, total_cents)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.id, item.product_id, item.vendor_id, item.quantity, item.unit_price_cents, item.total_cents]
      );
      await client.query('UPDATE products SET stock_qty = stock_qty - $1 WHERE id = $2', [item.quantity, item.product_id]);
      await client.query(
        `INSERT INTO inventory_events (product_id, event_type, quantity_delta, reason)
         VALUES ($1, 'sale', $2, $3)`,
        [item.product_id, -item.quantity, `Order #${order.id}`]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ order, items: resolvedItems });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Submit review
app.post('/api/reviews', async (req, res) => {
  try {
    const { product_id, customer_id, rating, title, body } = req.body;
    if (!product_id || !customer_id || !rating) {
      return res.status(400).json({ error: 'product_id, customer_id, and rating are required' });
    }
    const review = await pool.query(
      `INSERT INTO reviews (product_id, customer_id, rating, title, body, is_verified)
       VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING *`,
      [product_id, customer_id, Math.min(5, Math.max(1, rating)), title || '', body || '']
    );

    // Update product rating
    await pool.query(`
      UPDATE products SET
        rating_avg = (SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE product_id = $1),
        review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = $1)
      WHERE id = $1
    `, [product_id]);

    res.status(201).json({ review: review.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search
app.get('/api/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q) return res.json({ results: [] });
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const result = await pool.query(`
      SELECT p.id, p.name, p.slug, p.price_cents, p.rating_avg, p.review_count,
             v.name AS vendor_name, cat.name AS category_name, cat.icon AS category_icon
      FROM products p
      JOIN vendors v ON v.id = p.vendor_id
      JOIN categories cat ON cat.id = p.category_id
      WHERE p.is_active = TRUE AND (p.name ILIKE $1 OR p.description ILIKE $1)
      ORDER BY p.rating_avg DESC, p.review_count DESC
      LIMIT $2
    `, [`%${q}%`, limit]);
    res.json({ results: result.rows, query: q });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Analytics - Revenue by period
app.get('/api/analytics/revenue', async (req, res) => {
  try {
    const period = req.query.period || 'day';
    const trunc = { day: 'day', week: 'week', month: 'month' }[period] || 'day';
    const limit = Math.min(90, parseInt(req.query.limit) || 30);
    const result = await pool.query(`
      SELECT DATE_TRUNC($1, created_at) AS period,
             SUM(total_cents) AS revenue, COUNT(*) AS order_count
      FROM orders
      GROUP BY DATE_TRUNC($1, created_at)
      ORDER BY period DESC LIMIT $2
    `, [trunc, limit]);
    res.json({ revenue: result.rows.reverse(), period: trunc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Analytics - Top products
app.get('/api/analytics/top-products', async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const result = await pool.query(`
      SELECT p.id, p.name, p.price_cents, p.rating_avg,
             SUM(oi.quantity) AS total_sold, SUM(oi.total_cents) AS total_revenue,
             v.name AS vendor_name
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      JOIN vendors v ON v.id = p.vendor_id
      GROUP BY p.id, p.name, p.price_cents, p.rating_avg, v.name
      ORDER BY total_revenue DESC LIMIT $1
    `, [limit]);
    res.json({ products: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ShopStream running on port ${PORT}`);
  console.log(`Database: ${process.env.DATABASE_URL ? 'connected' : 'no DATABASE_URL set'}`);
});
