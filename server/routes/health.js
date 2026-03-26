const { Router } = require('express');
const { healthCheck } = require('../db/queries');

const router = Router();

router.get('/health', async (req, res) => {
  try {
    const result = await healthCheck();
    res.json({ status: 'healthy', ...result.rows[0] });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

module.exports = router;
