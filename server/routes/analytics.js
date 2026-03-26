const { Router } = require('express');
const { getRevenue, getTopProducts } = require('../db/queries');

const router = Router();

router.get('/revenue', async (req, res) => {
  try {
    const period = req.query.period || 'day';
    const trunc = { day: 'day', week: 'week', month: 'month' }[period] || 'day';
    const limit = Math.min(90, parseInt(req.query.limit) || 30);
    const result = await getRevenue(trunc, limit);
    res.json({ revenue: result.rows.reverse(), period: trunc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/top-products', async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const result = await getTopProducts(limit);
    res.json({ products: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
