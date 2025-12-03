const express = require('express');
const router = express.Router();
const {
  createContest,
  getManagerContests,
  getActiveContests,
  enrollCustomer,
  getContestLeaderboard,
} = require('../controllers/contestController');
const { protect } = require('../middleware/authMiddleware');

const upload = require('../middleware/uploadMiddleware');

router.route('/')
  .post(protect, createContest);

router.get('/manager', protect, getManagerContests);
router.get('/active', protect, getActiveContests);
router.post('/:id/enroll', protect, upload.single('proofMedia'), enrollCustomer);
router.get('/:id/leaderboard', protect, getContestLeaderboard);

module.exports = router;
