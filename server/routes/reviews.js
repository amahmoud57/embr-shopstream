const { Router } = require('express');
const { createReview, updateProductRating } = require('../db/queries');

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { product_id, customer_id, rating, title, body } = req.body;
    if (!product_id || !customer_id || !rating) {
      return res.status(400).json({ error: 'product_id, customer_id, and rating are required' });
    }
    const review = await createReview(product_id, customer_id, rating, title, body);
    await updateProductRating(product_id);
    res.status(201).json({ review: review.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
