const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  studentLogin, adminLogin, logout, changePassword, forgotPassword, resetPassword
} = require('../controllers/authController');

const router = express.Router();

// Slow down brute-force attempts on login/reset endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again in a few minutes.' }
});

router.post('/student-login', authLimiter,
  [body('identifier').notEmpty(), body('password').notEmpty()],
  validate, studentLogin);

router.post('/admin-login', authLimiter,
  [body('email').isEmail(), body('password').notEmpty()],
  validate, adminLogin);

router.post('/logout', protect, logout);

router.post('/change-password', protect,
  [body('newPassword').isLength({ min: 6 })],
  validate, changePassword);

router.post('/forgot-password', authLimiter,
  [body('identifier').notEmpty()], validate, forgotPassword);

router.post('/reset-password', authLimiter,
  [body('token').notEmpty(), body('newPassword').isLength({ min: 6 })],
  validate, resetPassword);

module.exports = router;
