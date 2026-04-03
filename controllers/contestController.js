const asyncHandler = require('express-async-handler');
const Contest = require('../models/Contest');
const Manager = require('../models/Manager');
const Coach = require('../models/Coach');
const Customer = require('../models/Customer');

// @desc    Create a new contest
// @route   POST /api/contests
// @access  Private (Manager)
const createContest = asyncHandler(async (req, res) => {
  const { title, type, startDate, endDate, description } = req.body;

  const manager = await Manager.findOne({ user: req.user._id });
  if (!manager) {
    res.status(404);
    throw new Error('Manager profile not found');
  }

  const contest = await Contest.create({
    title,
    type,
    startDate,
    endDate,
    description,
    createdBy: manager._id,
  });

  res.status(201).json(contest);
});

// @desc    Get contests created by manager
// @route   GET /api/contests/manager
// @access  Private (Manager)
const getManagerContests = asyncHandler(async (req, res) => {
  const manager = await Manager.findOne({ user: req.user._id });
  if (!manager) {
    res.status(404);
    throw new Error('Manager profile not found');
  }

  const contests = await Contest.find({ createdBy: manager._id }).sort({ createdAt: -1 });
  res.json(contests);
});

// @desc    Get active contests for a coach (from upline manager)
// @route   GET /api/contests/active
// @access  Private (Coach)
// @desc    Get active contests for a coach (from upline manager)
// @route   GET /api/contests/active
// @access  Private (Coach)
const getActiveContests = asyncHandler(async (req, res) => {
  const coach = await Coach.findOne({ user: req.user._id });
  if (!coach) {
    res.status(404);
    throw new Error('Coach profile not found');
  }

  // Traverse up the hierarchy to find the first manager
  let currentUplineUserId = coach.upline;
  let managerId = null;

  while (currentUplineUserId) {
    const manager = await Manager.findOne({ user: currentUplineUserId });
    if (manager) {
      managerId = manager._id;
      break;
    }

    const uplineCoach = await Coach.findOne({ user: currentUplineUserId });
    if (uplineCoach && uplineCoach.upline) {
      currentUplineUserId = uplineCoach.upline;
    } else {
      break;
    }
  }

  let query = { 
    isActive: true,
    endDate: { $gte: new Date() } 
  };

  if (managerId) {
    query.createdBy = managerId;
  }

  const contests = await Contest.find(query).sort({ startDate: 1 });
  res.json(contests);
});

// @desc    Enroll a customer in a contest
// @route   POST /api/contests/:id/enroll
// @access  Private (Coach)
const enrollCustomer = asyncHandler(async (req, res) => {
  const { customerId } = req.body;
  const contest = await Contest.findById(req.params.id);

  if (!contest) {
    res.status(404);
    throw new Error('Contest not found');
  }

  const coach = await Coach.findOne({ user: req.user._id });
  const customer = await Customer.findById(customerId);

  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }

  // Check if already enrolled
  const alreadyEnrolled = contest.participants.find(p => p.customer.toString() === customerId);
  if (alreadyEnrolled) {
    res.status(400);
    throw new Error('Customer already enrolled');
  }

  // Snapshot current metrics
  const startMetrics = {
    weight: customer.bodyComposition?.weight || 0,
    fatPercent: customer.bodyComposition?.fatPercent || 0,
    muscleMassPercent: customer.bodyComposition?.muscleMassPercent || 0,
    visceralFat: customer.bodyComposition?.visceralFat || 0,
    date: new Date(),
    proofUrl: req.file ? req.file.path : null,
    proofType: req.file ? (req.file.mimetype.startsWith('video/') ? 'video' : 'image') : null,
  };

  contest.participants.push({
    customer: customerId,
    coach: coach._id,
    startMetrics,
    currentMetrics: startMetrics, // Initialize with same
  });

  await contest.save();
  res.json({ message: 'Customer enrolled successfully' });
});

// @desc    Get contest leaderboard
// @route   GET /api/contests/:id/leaderboard
// @access  Private (Manager/Coach)
const getContestLeaderboard = asyncHandler(async (req, res) => {
  const contest = await Contest.findById(req.params.id)
    .populate('participants.customer', 'name')
    .populate('participants.coach', 'name wellnessCenterName');

  if (!contest) {
    res.status(404);
    throw new Error('Contest not found');
  }

  // Calculate rankings
  // Logic: Difference between Start and Current metrics
  // For Fat Loss: Start - Current (Higher is better)
  // For Muscle Gain: Current - Start (Higher is better)
  // For Weight Loss: Start - Current (Higher is better)

  const leaderboard = contest.participants.map(p => {
    let change = 0;
    let metricLabel = '';

    // Update current metrics from live customer data (optional, but better for real-time)
    // For now, we rely on what's stored in participants array, 
    // BUT we should probably update 'currentMetrics' whenever a customer is updated.
    // OR, we can just fetch the customer's current stats right here.
    // Let's use the stored 'currentMetrics' for now, assuming we might update it via a webhook or manual sync.
    // ACTUALLY: Let's fetch the LIVE customer data to be accurate.
    
    // Note: Since we populated 'customer', we might have access to it if we populated the whole object.
    // Mongoose populate usually returns the doc. Let's assume customer doc has bodyComposition.
    // We need to populate bodyComposition fields if they are nested? No, they are in the doc.
    
    // Re-fetch customer to be sure we have latest stats
    // Optimization: We can do this in the map if list is small, or populate fully.
    // Let's assume 'participants.customer' is populated with name. We need more.
  });

  // Better approach: Populate full customer to get latest stats
  const contestWithData = await Contest.findById(req.params.id)
    .populate('participants.customer')
    .populate('participants.coach', 'name wellnessCenterName');

  const rankedParticipants = contestWithData.participants.map(p => {
    if (!p.customer) return null; // Handle deleted customers

    const currentStats = p.customer.bodyComposition || {};
    const startStats = p.startMetrics || {};
    let change = 0;
    let score = 0;

    if (contest.type === 'fat-loss') {
      // Change = Start - Current
      change = (startStats.fatPercent || 0) - (currentStats.fatPercent || 0);
      score = change;
    } else if (contest.type === 'muscle-gain') {
      // Change = Current - Start
      change = (currentStats.muscleMassPercent || 0) - (startStats.muscleMassPercent || 0);
      score = change;
    } else if (contest.type === 'weight-loss') {
       // Change = Start - Current
       change = (startStats.weight || 0) - (currentStats.weight || 0);
       score = change;
    }

    return {
      customerName: p.customer.name,
      coachName: p.coach?.name || 'Unknown',
      centerName: p.coach?.wellnessCenterName || '',
      startMetrics: startStats,
      currentMetrics: currentStats,
      change: parseFloat(change.toFixed(2)),
      score: score
    };
  })
  .filter(p => p !== null)
  .sort((a, b) => b.score - a.score); // Descending order

  res.json(rankedParticipants);
});

module.exports = {
  createContest,
  getManagerContests,
  getActiveContests,
  enrollCustomer,
  getContestLeaderboard,
};
