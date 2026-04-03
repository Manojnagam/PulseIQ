const express = require('express');
const router = express.Router();
const { sendOtp, verifyOtp, login, signup } = require('../controllers/authController');

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/login', login);
router.post('/signup', signup);

module.exports = router;
