const express = require('express');
const router = express.Router();
const {
  createResource,
  getManagerResources,
  getCoachResources,
  deleteResource,
} = require('../controllers/resourceController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .post(protect, createResource);

router.route('/manager')
  .get(protect, getManagerResources);

router.route('/coach')
  .get(protect, getCoachResources);

router.route('/:id')
  .delete(protect, deleteResource);

module.exports = router;
