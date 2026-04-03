const { Router } = require('express');
const { getCategories } = require('../controllers/websiteController');
const { authMiddleware, requireEmployeeWebsiteMatch } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = Router();

router.get(
  '/:websiteId/categories',
  authMiddleware,
  requireEmployeeWebsiteMatch('websiteId'),
  asyncHandler(getCategories)
);

module.exports = router;
