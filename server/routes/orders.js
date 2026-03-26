const { Router } = require('express');
const { getOrders, getOrderById, getOrderItems, getPool } = require('../db/queries');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const status = req.query.status || '';

    const [countQ, rows] = await getOrders(status, limit, offset);
    const total = parseInt(countQ.rows[0].count);

    res.json({ orders: rows.rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await getOrderById(req.params.id);
    if (!order.rows.length) return res.status(404).json({ error: 'Order not found' });

    const items = await getOrderItems(req.params.id);
    res.json({ order: order.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const pool = getPool();
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

module.exports = router;
