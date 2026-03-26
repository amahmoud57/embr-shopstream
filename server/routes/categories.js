const { Router } = require('express');
const { getCategories } = require('../db/queries');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await getCategories();
    res.json({ categories: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
