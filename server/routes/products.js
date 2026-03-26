const { Router } = require('express');
const { getProducts, getProductById, getProductReviews, searchProducts } = require('../db/queries');

const router = Router();

router.get('/', async (req, res) => {
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

    const [countQ, rows] = await getProducts(conditions, params, sortColumn, order, limit, offset);
    const total = parseInt(countQ.rows[0].count);

    res.json({ products: rows.rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q) return res.json({ results: [] });
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const result = await searchProducts(q, limit);
    res.json({ results: result.rows, query: q });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await getProductById(id);
    if (!product.rows.length) return res.status(404).json({ error: 'Product not found' });

    const reviews = await getProductReviews(id);
    res.json({ product: product.rows[0], reviews: reviews.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
