const { Router } = require('express');
const { getVendors, getVendorById, getVendorProducts } = require('../db/queries');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await getVendors();
    res.json({ vendors: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const vendor = await getVendorById(req.params.id);
    if (!vendor.rows.length) return res.status(404).json({ error: 'Vendor not found' });

    const products = await getVendorProducts(req.params.id);
    res.json({ vendor: vendor.rows[0], products: products.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
