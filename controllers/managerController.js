const asyncHandler = require('express-async-handler');
const Manager = require('../models/Manager');
const Coach = require('../models/Coach');
const Customer = require('../models/Customer');

// @desc    Get Manager Profile & Stats
// @route   GET /api/manager/me
// @access  Private (Manager)
const getManagerProfile = asyncHandler(async (req, res) => {
  const manager = await Manager.findOne({ user: req.user._id });

  if (!manager) {
    res.status(404);
    throw new Error('Manager profile not found');
  }

  // Mock stats for now - in real app, aggregate from DB
  const stats = {
    totalCoaches: await Coach.countDocuments({ manager: manager._id }),
    totalCustomers: await Customer.countDocuments(), // Simplified
    totalVolume: 150000, // Mock
  };

  res.json({
    ...manager.toObject(),
    stats,
  });
});

// @desc    Get All Coaches (Downline)
// @route   GET /api/manager/coaches
// @access  Private (Manager)
const getManagerCoaches = asyncHandler(async (req, res) => {
  const manager = await Manager.findOne({ user: req.user._id });

  if (!manager) {
    res.status(404);
    throw new Error('Manager profile not found');
  }

  const coaches = await Coach.find({ manager: manager._id });

  res.json(coaches);
});

module.exports = { getManagerProfile, getManagerCoaches };
