const { Router } = require('express');
const { body } = require('express-validator');
const { login } = require('../controllers/authController');
const { handleValidation } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = Router();

router.post(
  '/login',
  [
    body('email').trim().notEmpty().isEmail(),
    body('password').isString().notEmpty(),
  ],
  handleValidation,
  asyncHandler(login)
);

module.exports = router;
