const asyncHandler = require('express-async-handler');
const Manager = require('../models/Manager');
const Coach = require('../models/Coach');
const Customer = require('../models/Customer');

// @desc    Get Manager Profile & Stats
// @route   GET /api/manager/me
// @access  Private (Manager)
// @desc    Get Manager Profile & Stats
// @route   GET /api/manager/me
// @access  Private (Manager)
const getManagerProfile = asyncHandler(async (req, res) => {
  const manager = await Manager.findOne({ user: req.user._id }).populate('verifiedDownlines');

  if (!manager) {
    res.status(404);
    throw new Error('Manager profile not found');
  }

  // Get all downline coach IDs
  const downlineCoachIds = manager.verifiedDownlines.map(coach => coach._id);

  // 1. Total Coaches
  const totalCoaches = downlineCoachIds.length;

  // 2. Active Coaches (Coaches with at least 1 active customer)
  // Find customers belonging to these coaches with status 'active'
  const activeCoachesWithCustomers = await Customer.distinct('coach', {
    coach: { $in: downlineCoachIds },
    status: 'active'
  });
  const activeCoaches = activeCoachesWithCustomers.length;

  // 3. Total Volume & Network Revenue
  // Sum of packPrice for all active customers under downline coaches
  const volumeStats = await Customer.aggregate([
    {
      $match: {
        coach: { $in: downlineCoachIds },
        status: 'active'
      }
    },
    {
      $group: {
        _id: null,
        totalVolume: { $sum: '$packPrice' }
      }
    }
  ]);

  const totalVolume = volumeStats.length > 0 ? volumeStats[0].totalVolume : 0;
  const networkRevenue = totalVolume; // Assuming 1:1 ratio for now, or apply a multiplier

  // 4. Recruitment Rate (New coaches in last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const newRecruits = manager.verifiedDownlines.filter(coach => 
    new Date(coach.createdAt) >= thirtyDaysAgo
  ).length;

  const stats = {
    networkRevenue,
    totalVolume,
    activeCoaches,
    totalCoaches,
    recruitmentRate: newRecruits,
    retentionRate: 95 // Placeholder for now, hard to calc without historical data
  };

  res.json({
    ...manager.toObject(),
    stats,
  });
});

// @desc    Update Manager Profile
// @route   PUT /api/manager/me
// @access  Private (Manager)
const updateManagerProfile = asyncHandler(async (req, res) => {
  const manager = await Manager.findOne({ user: req.user._id });

  if (!manager) {
    res.status(404);
    throw new Error('Manager profile not found');
  }

  const allowedUpdates = ['name', 'level', 'lineLevel', 'uplineName', 'uplineMobile'];

  allowedUpdates.forEach((field) => {
    if (typeof req.body[field] !== 'undefined') {
      manager[field] = req.body[field];
    }
  });

  const updatedManager = await manager.save();

  res.json(updatedManager);
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

module.exports = { getManagerProfile, updateManagerProfile, getManagerCoaches };
