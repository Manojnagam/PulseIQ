const express = require('express');
const router = express.Router();
const { getCustomerProfile, updateCustomerProfile } = require('../controllers/customerController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.route('/me')
  .get(protect, authorize('customer'), getCustomerProfile)
  .put(protect, authorize('customer'), updateCustomerProfile);

module.exports = router;
