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
  const manager = await Manager.findOne({ user: req.user._id })
    .populate('verifiedDownlines')
    .populate('downlineManagers');

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

  // 5. Revenue History (Last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const revenueHistory = await Customer.aggregate([
    {
      $match: {
        coach: { $in: downlineCoachIds },
        'payments.date': { $gte: sixMonthsAgo }
      }
    },
    { $unwind: '$payments' },
    {
      $match: {
        'payments.date': { $gte: sixMonthsAgo }
      }
    },
    {
      $group: {
        _id: {
          month: { $month: '$payments.date' },
          year: { $year: '$payments.date' }
        },
        value: { $sum: '$payments.amount' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  // Format for Recharts (Jan, Feb, etc.)
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const formattedRevenue = revenueHistory.map(item => ({
    name: monthNames[item._id.month - 1],
    value: item.value
  }));

  // 6. Leaderboard Data Calculation
  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);

  const lastMonthStart = new Date(currentMonthStart);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  
  const lastMonthEnd = new Date(currentMonthStart);
  lastMonthEnd.setMilliseconds(-1);

  const coachesStats = await Promise.all(manager.verifiedDownlines.map(async (coach) => {
    // A. Volume (Total & Growth)
    // Current Month Volume
    const currentMonthVolume = await Customer.aggregate([
      { 
        $match: { 
          coach: coach._id, 
          'payments.date': { $gte: currentMonthStart } 
        } 
      },
      { $unwind: '$payments' },
      { 
        $match: { 
          'payments.date': { $gte: currentMonthStart } 
        } 
      },
      { $group: { _id: null, total: { $sum: '$payments.amount' } } }
    ]);

    // Last Month Volume
    const lastMonthVolume = await Customer.aggregate([
      { 
        $match: { 
          coach: coach._id, 
          'payments.date': { $gte: lastMonthStart, $lte: lastMonthEnd } 
        } 
      },
      { $unwind: '$payments' },
      { 
        $match: { 
          'payments.date': { $gte: lastMonthStart, $lte: lastMonthEnd } 
        } 
      },
      { $group: { _id: null, total: { $sum: '$payments.amount' } } }
    ]);

    const cmv = currentMonthVolume.length > 0 ? currentMonthVolume[0].total : 0;
    const lmv = lastMonthVolume.length > 0 ? lastMonthVolume[0].total : 0;
    
    // Calculate Growth
    let growth = 0;
    if (lmv > 0) {
      growth = ((cmv - lmv) / lmv) * 100;
    } else if (cmv > 0) {
      growth = 100; // 100% growth if started from 0
    }

    // Total Volume (Lifetime)
    const totalVol = await Customer.aggregate([
      { $match: { coach: coach._id, status: 'active' } },
      { $group: { _id: null, total: { $sum: '$packPrice' } } }
    ]);

    // B. Recruitment Count
    const recruits = await Coach.countDocuments({ upline: coach._id });

    return {
      id: coach._id,
      name: coach.name,
      level: coach.wellnessCenterName || 'Coach',
      volume: totalVol.length > 0 ? totalVol[0].total : 0,
      monthlyVolume: cmv,
      recruits,
      growth: Math.round(growth),
      image: null
    };
  }));

  // Sort Lists
  const topProducers = [...coachesStats].sort((a, b) => b.volume - a.volume).slice(0, 5);
  const topRecruiters = [...coachesStats].sort((a, b) => b.recruits - a.recruits).slice(0, 5);
  const moversAndShakers = [...coachesStats].sort((a, b) => b.growth - a.growth).slice(0, 5);

  // 7. Financials (Commissions & Payouts)
  // Simple Logic: 5% override on total network volume
  const totalEarnings = totalVolume * 0.05;
  const pendingPayout = totalEarnings * 0.2; // Mock: 20% pending
  const lastPayout = totalEarnings * 0.1; // Mock: 10% last paid

  const financials = {
    totalEarnings,
    pendingPayout,
    lastPayout,
    commissionBreakdown: [
      { type: 'Downline Overrides', amount: totalEarnings * 0.8, percentage: 80 },
      { type: 'Direct Sales', amount: totalEarnings * 0.1, percentage: 10 },
      { type: 'Bonuses', amount: totalEarnings * 0.1, percentage: 10 }
    ],
    payoutHistory: [
      { id: 1, date: '2023-11-01', amount: 12500, status: 'Paid', method: 'Bank Transfer' },
      { id: 2, date: '2023-10-01', amount: 11200, status: 'Paid', method: 'Bank Transfer' },
      { id: 3, date: '2023-09-01', amount: 9800, status: 'Paid', method: 'Bank Transfer' },
    ]
  };

  const stats = {
    networkRevenue,
    totalVolume,
    activeCoaches,
    totalCoaches,
    recruitmentRate: newRecruits,
    retentionRate: 95
  };

  res.json({
    ...manager.toObject(),
    stats,
    revenueHistory: formattedRevenue,
    leaderboard: {
        topProducers,
        topRecruiters,
        moversAndShakers
    },
    // Keep topCoaches for backward compatibility if needed, or replace with topProducers
    topCoaches: topProducers, 
    financials
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

// @desc    Get Manager Team Stats (Full List for Leaderboard/Financials)
// @route   GET /api/manager/team-stats
// @access  Private (Manager)
const getManagerTeamStats = asyncHandler(async (req, res) => {
  const manager = await Manager.findOne({ user: req.user._id }).populate('verifiedDownlines');

  if (!manager) {
    res.status(404);
    throw new Error('Manager profile not found');
  }

  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);

  const lastMonthStart = new Date(currentMonthStart);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  
  const lastMonthEnd = new Date(currentMonthStart);
  lastMonthEnd.setMilliseconds(-1);

  const teamStats = await Promise.all(manager.verifiedDownlines.map(async (coach) => {
    // 1. Current Month Volume
    const currentMonthVolume = await Customer.aggregate([
      { 
        $match: { 
          coach: coach._id, 
          'payments.date': { $gte: currentMonthStart } 
        } 
      },
      { $unwind: '$payments' },
      { 
        $match: { 
          'payments.date': { $gte: currentMonthStart } 
        } 
      },
      { $group: { _id: null, total: { $sum: '$payments.amount' } } }
    ]);

    // 2. Last Month Volume
    const lastMonthVolume = await Customer.aggregate([
      { 
        $match: { 
          coach: coach._id, 
          'payments.date': { $gte: lastMonthStart, $lte: lastMonthEnd } 
        } 
      },
      { $unwind: '$payments' },
      { 
        $match: { 
          'payments.date': { $gte: lastMonthStart, $lte: lastMonthEnd } 
        } 
      },
      { $group: { _id: null, total: { $sum: '$payments.amount' } } }
    ]);

    const cmv = currentMonthVolume.length > 0 ? currentMonthVolume[0].total : 0;
    const lmv = lastMonthVolume.length > 0 ? lastMonthVolume[0].total : 0;
    
    // 3. Growth
    let growth = 0;
    if (lmv > 0) {
      growth = ((cmv - lmv) / lmv) * 100;
    } else if (cmv > 0) {
      growth = 100;
    }

    // 4. Total Volume (Lifetime)
    const totalVol = await Customer.aggregate([
      { $match: { coach: coach._id, status: 'active' } },
      { $group: { _id: null, total: { $sum: '$packPrice' } } }
    ]);

    // 5. Recruits
    const recruits = await Coach.countDocuments({ upline: coach._id });

    return {
      id: coach._id,
      name: coach.name,
      level: coach.wellnessCenterName || 'Coach',
      volume: totalVol.length > 0 ? totalVol[0].total : 0,
      monthlyVolume: cmv,
      recruits,
      growth: Math.round(growth),
      revenue: cmv // Assuming revenue = monthly volume for now
    };
  }));

  res.json(teamStats);
});

module.exports = { getManagerProfile, updateManagerProfile, getManagerCoaches, getManagerTeamStats };
