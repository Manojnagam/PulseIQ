const express = require('express');
const router = express.Router();
const { getManagerProfile, updateManagerProfile, getManagerCoaches, getManagerTeamStats } = require('../controllers/managerController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/me', protect, authorize('manager'), getManagerProfile);
router.put('/me', protect, authorize('manager'), updateManagerProfile);
router.get('/coaches', protect, authorize('manager'), getManagerCoaches);
router.get('/team-stats', protect, authorize('manager'), getManagerTeamStats);

module.exports = router;
