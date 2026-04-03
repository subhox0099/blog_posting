const { Router } = require('express');
const {
  listWebsites,
  listBlogsForWebsite,
  getBlogById,
  approveBlog,
  rejectBlog,
  createEmployee,
  listEmployees,
  updateEmployee,
  setEmployeeStatus,
  deleteEmployee,
  resetEmployeePassword,
} = require('../controllers/adminController');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');
const { body, param, query } = require('express-validator');
const { handleValidation } = require('../middleware/validate');

const router = Router();

router.use(authMiddleware, requireRole('ADMIN'));

router.get('/websites', asyncHandler(listWebsites));
router.get('/blogs/detail/:id', asyncHandler(getBlogById));
router.get('/blogs/:websiteId', asyncHandler(listBlogsForWebsite));
router.put('/blogs/approve/:id', asyncHandler(approveBlog));
router.put('/blogs/reject/:id', asyncHandler(rejectBlog));

// Employee management
router.post(
  '/employees',
  [
    body('email').isEmail().trim().notEmpty(),
    body('password').isString().notEmpty(),
    body('websiteId').isString().notEmpty(),
  ],
  handleValidation,
  asyncHandler(createEmployee)
);

router.get(
  '/employees',
  [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })],
  handleValidation,
  asyncHandler(listEmployees)
);

router.put(
  '/employees/:id',
  [param('id').isString().notEmpty()],
  handleValidation,
  asyncHandler(updateEmployee)
);

router.patch(
  '/employees/:id/status',
  [param('id').isString().notEmpty(), body('isActive').isBoolean()],
  handleValidation,
  asyncHandler(setEmployeeStatus)
);

router.post(
  '/employees/:id/reset-password',
  [param('id').isString().notEmpty(), body('password').isString().notEmpty()],
  handleValidation,
  asyncHandler(resetEmployeePassword)
);

router.delete(
  '/employees/:id',
  [param('id').isString().notEmpty()],
  handleValidation,
  asyncHandler(deleteEmployee)
);

module.exports = router;
