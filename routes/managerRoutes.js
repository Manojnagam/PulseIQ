const express = require('express');
const router = express.Router();
const { getManagerProfile, getManagerCoaches } = require('../controllers/managerController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/me', protect, authorize('manager'), getManagerProfile);
router.get('/coaches', protect, authorize('manager'), getManagerCoaches);

module.exports = router;
