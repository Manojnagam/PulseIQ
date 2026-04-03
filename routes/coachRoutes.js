const express = require('express');
const router = express.Router();
const { getCoachProfile, getCoachDownlines, createCustomer, markAttendance, updateCoachProfile, selfRegister, updateCustomer, getBusinessStats, getNetworkLeads, addCheckIn, renewMembership, deleteCustomer, addPayment, assignFoodToClients } = require('../controllers/coachController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/me', protect, authorize('coach'), getCoachProfile);
router.get('/downlines', protect, authorize('coach'), getCoachDownlines);
router.post('/customers', protect, authorize('coach'), createCustomer);
router.post('/customers/:id/checkin', protect, authorize('coach'), addCheckIn);
router.post('/customers/:id/renew', protect, authorize('coach'), renewMembership);
router.post('/customers/:id/attendance', protect, authorize('coach'), markAttendance);
router.put('/customers/:id', protect, authorize('coach'), updateCustomer);
router.delete('/customers/:id', protect, authorize('coach'), deleteCustomer);
router.post('/customers/:id/payment', protect, authorize('coach'), addPayment);
router.put('/profile', protect, authorize('coach'), updateCoachProfile);
router.post('/self-register', protect, authorize('coach'), selfRegister);
router.post('/assign-food', protect, authorize('coach'), assignFoodToClients);

router.get('/stats', protect, authorize('coach'), getBusinessStats);
router.get('/network-leads', protect, authorize('coach'), getNetworkLeads);

module.exports = router;
