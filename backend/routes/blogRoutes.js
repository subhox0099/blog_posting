const { Router } = require('express');
const {
  createBlog,
  listMyBlogs,
  listApprovedByWebsite,
  listLatest,
  listByCategorySlug,
  getPublicBlogById,
} = require('../controllers/blogController');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');
const { uploadBlogImage } = require('../middleware/uploadBlogImage');

const router = Router();

router.get('/my', authMiddleware, requireRole('EMPLOYEE'), asyncHandler(listMyBlogs));

router.post(
  '/',
  authMiddleware,
  requireRole('EMPLOYEE'),
  uploadBlogImage,
  asyncHandler(createBlog)
);

router.get('/:websiteId/latest', asyncHandler(listLatest));
router.get('/:websiteId/category/:slug', asyncHandler(listByCategorySlug));
router.get('/:websiteId/post/:blogId', asyncHandler(getPublicBlogById));
router.get('/:websiteId', asyncHandler(listApprovedByWebsite));

module.exports = router;
