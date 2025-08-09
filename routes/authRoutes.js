const express = require('express');
const router = express.Router();
const {
  signup,
  login,
  verifyEmail,
  resendVerification
} = require('../controllers/authController');

// Public routes
router.post('/signup', signup);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);

module.exports = router;