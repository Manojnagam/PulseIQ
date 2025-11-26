const asyncHandler = require('express-async-handler');
const Coach = require('../models/Coach');
const Customer = require('../models/Customer');

// @desc    Get Coach Profile & Stats
// @route   GET /api/coach/me
// @access  Private (Coach)
const getCoachProfile = asyncHandler(async (req, res) => {
  const coach = await Coach.findOne({ user: req.user._id });

  if (!coach) {
    res.status(404);
    throw new Error('Coach profile not found');
  }

  // Fetch downlines count dynamically
  const downlinesCount = await Customer.countDocuments({ coach: coach._id });

  res.json({
    ...coach.toObject(),
    totalDownlines: downlinesCount,
  });
});

// @desc    Get Coach Downlines
// @route   GET /api/coach/downlines
// @access  Private (Coach)
const getCoachDownlines = asyncHandler(async (req, res) => {
  const coach = await Coach.findOne({ user: req.user._id });

  if (!coach) {
    res.status(404);
    throw new Error('Coach profile not found');
  }

  const downlines = await Customer.find({ coach: coach._id });

  res.json(downlines);
});

// @desc    Create New Customer
// @route   POST /api/coach/customers
// @access  Private (Coach)
const createCustomer = asyncHandler(async (req, res) => {
  const coach = await Coach.findOne({ user: req.user._id });

  if (!coach) {
    res.status(404);
    throw new Error('Coach profile not found');
  }

  let {
    name,
    mobile,
    age,
    gender,
    referrer,
    referrerMobile,
    pack,
    packPrice,
    date, // Allow manual date entry
    bodyComposition,
    idealBodyComposition,
    status,
    initialPayment
  } = req.body;

  // Helper to sanitize numeric fields
  const sanitizeNumber = (val) => (val === '' || val === null || val === undefined ? undefined : Number(val));

  age = sanitizeNumber(age);
  packPrice = sanitizeNumber(packPrice);

  // Sanitize Body Composition
  if (bodyComposition) {
    for (const key in bodyComposition) {
      bodyComposition[key] = sanitizeNumber(bodyComposition[key]);
    }
  }

  // Sanitize Ideal Body Composition
  if (idealBodyComposition) {
    for (const key in idealBodyComposition) {
      idealBodyComposition[key] = sanitizeNumber(idealBodyComposition[key]);
    }
  }

  // Calculate Target Body Composition (Current - Ideal)
  const targetBodyComposition = {};
  if (bodyComposition && idealBodyComposition) {
    for (const key in bodyComposition) {
      if (
        bodyComposition[key] !== undefined &&
        idealBodyComposition[key] !== undefined &&
        !isNaN(bodyComposition[key]) &&
        !isNaN(idealBodyComposition[key])
      ) {
        targetBodyComposition[key] = (bodyComposition[key] - idealBodyComposition[key]).toFixed(2);
      }
    }
  }

  // Check if customer with this mobile already exists
  const existingCustomer = await Customer.findOne({ mobile });
  
  if (existingCustomer) {
    // If customer exists and belongs to this coach, update it
    if (existingCustomer.coach && existingCustomer.coach.toString() === coach._id.toString()) {
      // Update existing customer
      existingCustomer.name = name || existingCustomer.name;
      existingCustomer.age = age !== undefined ? age : existingCustomer.age;
      existingCustomer.gender = gender || existingCustomer.gender;
      existingCustomer.referrer = referrer || existingCustomer.referrer;
      existingCustomer.referrerMobile = referrerMobile || existingCustomer.referrerMobile;
      existingCustomer.pack = pack || existingCustomer.pack;
      existingCustomer.packPrice = packPrice !== undefined ? packPrice : existingCustomer.packPrice;
      existingCustomer.date = date || existingCustomer.date;
      existingCustomer.status = status || existingCustomer.status;
      existingCustomer.pipelineStage = status === 'lead' ? 'New' : (existingCustomer.pipelineStage || 'Converted');
      
      if (bodyComposition) existingCustomer.bodyComposition = bodyComposition;
      if (idealBodyComposition) existingCustomer.idealBodyComposition = idealBodyComposition;
      if (targetBodyComposition && Object.keys(targetBodyComposition).length > 0) {
        existingCustomer.targetBodyComposition = targetBodyComposition;
      }
      
      // Add initial payment if provided
      if (initialPayment && initialPayment.amount) {
        existingCustomer.payments.push({
          amount: Number(initialPayment.amount),
          date: date || Date.now(),
          type: initialPayment.type || 'Cash',
          notes: initialPayment.notes || 'Initial Payment'
        });
      }
      
      const updatedCustomer = await existingCustomer.save();
      res.status(200).json(updatedCustomer);
      return;
    } else {
      // Customer exists but belongs to another coach or has no coach
      res.status(400);
      throw new Error(`A customer with mobile number ${mobile} already exists${existingCustomer.coach ? ' under another coach' : ''}. Please use a different mobile number or contact support to transfer this customer.`);
    }
  }

  // Prepare payments array if initialPayment exists
  const payments = [];
  if (initialPayment && initialPayment.amount) {
      payments.push({
          amount: Number(initialPayment.amount),
          date: date || Date.now(),
          type: initialPayment.type || 'Cash',
          notes: initialPayment.notes || 'Initial Payment'
      });
  }

  const customer = await Customer.create({
    coach: coach._id,
    name,
    mobile,
    age,
    gender,
    referrer,
    referrerMobile,
    pack,
    packPrice,
    date: date || Date.now(),
    bodyComposition,
    idealBodyComposition,
    targetBodyComposition,
    status: status || 'active',
    pipelineStage: status === 'lead' ? 'New' : 'Converted',
    payments,
    attendance: [] 
  });

  res.status(201).json(customer);
});

// @desc    Mark Customer Attendance
// @route   POST /api/coach/customers/:id/attendance
// @access  Private (Coach)
const markAttendance = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }

  // Check if coach owns this customer
  const coach = await Coach.findOne({ user: req.user._id });
  if (!coach || customer.coach.toString() !== coach._id.toString()) {
    res.status(401);
    throw new Error('Not authorized');
  }

  // Check if already marked for today (optional but good UX)
  const today = new Date().setHours(0, 0, 0, 0);
  const alreadyMarked = customer.attendance.some(date => {
    const d = new Date(date).setHours(0, 0, 0, 0);
    return d === today;
  });

  if (alreadyMarked) {
    res.status(400);
    throw new Error('Attendance already marked for today');
  }

  customer.attendance.push(new Date());
  await customer.save();

  res.json({ message: 'Attendance marked', attendance: customer.attendance });
});

// @desc    Update Coach Profile
// @route   PUT /api/coach/profile
// @access  Private (Coach)
const updateCoachProfile = asyncHandler(async (req, res) => {
  const coach = await Coach.findOne({ user: req.user._id });

  if (!coach) {
    res.status(404);
    throw new Error('Coach profile not found');
  }

  const { name, age, wellnessCenterName, uplineCoachName, uplineCoachMobile, mobile } = req.body;

  coach.name = name || coach.name;
  coach.age = age || coach.age;
  coach.wellnessCenterName = wellnessCenterName || coach.wellnessCenterName;
  coach.uplineCoachName = uplineCoachName || coach.uplineCoachName;
  coach.uplineCoachMobile = uplineCoachMobile || coach.uplineCoachMobile;
  coach.mobile = mobile || coach.mobile;

  const updatedCoach = await coach.save();
  res.json(updatedCoach);
});

// @desc    Register Coach as Customer (Self-Tracking)
// @route   POST /api/coach/self-register
// @access  Private (Coach)
const selfRegister = asyncHandler(async (req, res) => {
  const coach = await Coach.findOne({ user: req.user._id });

  if (!coach) {
    res.status(404);
    throw new Error('Coach profile not found');
  }

  // Check if already registered as customer
  const existingCustomer = await Customer.findOne({ mobile: coach.mobile });
  if (existingCustomer) {
    // If already registered but referrer is 'Self', update it with upline name
    if (existingCustomer.referrer === 'Self' && coach.uplineCoachName) {
      existingCustomer.referrer = coach.uplineCoachName;
      await existingCustomer.save();
      res.json(existingCustomer);
      return;
    }

    res.status(400);
    throw new Error('You are already registered as a customer');
  }

  const customer = await Customer.create({
    coach: coach._id, // Self-coached
    name: coach.name,
    mobile: coach.mobile,
    age: coach.age,
    gender: 'Other', // Default or ask in UI
    referrer: coach.uplineCoachName || 'Self',
    pack: 'Coach Self-Use',
    packPrice: 0,
    attendance: []
  });

  res.status(201).json(customer);
});

// @desc    Update Customer Details (including Body Composition)
// @route   PUT /api/coach/customers/:id
// @access  Private (Coach)
const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }

  // Verify coach owns this customer
  const coach = await Coach.findOne({ user: req.user._id });
  if (customer.coach.toString() !== coach._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to update this customer');
  }

  let {
    name,
    mobile,
    age,
    gender,
    referrer,
    referrerMobile,
    pack,
    packPrice,
    bodyComposition,
    idealBodyComposition,
    targetBodyComposition,
    status,
    pipelineStage,
    notes,
    dietPlan
  } = req.body;

  customer.name = name || customer.name;
  customer.mobile = mobile || customer.mobile;
  customer.age = age || customer.age;
  customer.gender = gender || customer.gender;
  customer.referrer = referrer || customer.referrer;
  customer.referrerMobile = referrerMobile || customer.referrerMobile;
  customer.pack = pack || customer.pack;
  customer.packPrice = packPrice || customer.packPrice;
  
  // CRM Fields
  if (status) customer.status = status;
  if (pipelineStage) customer.pipelineStage = pipelineStage;
  if (notes) customer.notes = notes;
  
  if (req.body.followUp) {
      customer.followUp = { ...customer.followUp, ...req.body.followUp };
  }

  // Helper to sanitize numeric fields
  const sanitizeNumber = (val) => (val === '' || val === null || val === undefined ? undefined : Number(val));

  if (bodyComposition) {
    customer.bodyComposition = bodyComposition;
    for (const key in customer.bodyComposition) {
        if (typeof customer.bodyComposition[key] === 'object') continue; // Skip nested if any
        customer.bodyComposition[key] = sanitizeNumber(customer.bodyComposition[key]);
    }
  }
  
  if (idealBodyComposition) {
    customer.idealBodyComposition = idealBodyComposition;
    for (const key in customer.idealBodyComposition) {
        if (typeof customer.idealBodyComposition[key] === 'object') continue;
        customer.idealBodyComposition[key] = sanitizeNumber(customer.idealBodyComposition[key]);
    }
  }

  if (targetBodyComposition) customer.targetBodyComposition = targetBodyComposition;

  if (dietPlan) {
    customer.dietPlan = dietPlan;
  }

  // Recalculate Target if needed
  if (customer.bodyComposition && customer.idealBodyComposition) {
     const target = {};
     for (const key in customer.bodyComposition) {
        const current = customer.bodyComposition[key];
        const ideal = customer.idealBodyComposition[key];
        if (current !== undefined && ideal !== undefined && !isNaN(current) && !isNaN(ideal)) {
            target[key] = (current - ideal).toFixed(2);
        }
     }
     customer.targetBodyComposition = target;
  }

  const updatedCustomer = await customer.save();
  res.json(updatedCustomer);
});

// @desc    Get Coach Business Stats
// @route   GET /api/coach/stats
// @access  Private (Coach)
const getBusinessStats = asyncHandler(async (req, res) => {
  const coach = await Coach.findOne({ user: req.user._id });
  if (!coach) {
    res.status(404);
    throw new Error('Coach profile not found');
  }

  const customers = await Customer.find({ coach: coach._id });

  // 1. Total Revenue (Sum of packPrice for active customers)
  const totalRevenue = customers
    .filter(c => c.status === 'active' && c.packPrice)
    .reduce((acc, curr) => acc + curr.packPrice, 0);

  // 2. Active Leads
  const activeLeads = customers.filter(c => c.status === 'lead').length;

  // 3. Churn Risk (Active customers with no attendance in last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const churnRisk = customers.filter(c => {
    if (c.status !== 'active') return false;
    // If no attendance at all, risk
    if (!c.attendance || c.attendance.length === 0) return true;
    // Check last attendance
    const lastAttendance = new Date(c.attendance[c.attendance.length - 1]);
    return lastAttendance < sevenDaysAgo;
  }).length;

  // 4. Monthly Growth (New customers this month)
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  const monthlyGrowth = customers.filter(c => new Date(c.createdAt) >= startOfMonth).length;

  res.json({
    totalRevenue,
    activeLeads,
    churnRisk,
    monthlyGrowth,
    totalClients: customers.length
  });
});



// @desc    Add a check-in (update body comp and log history)
// @route   POST /api/coach/customers/:id/checkin
// @access  Private/Coach
const addCheckIn = asyncHandler(async (req, res) => {
  const {
    weight,
    fatPercent,
    visceralFat,
    muscleMassPercent,
    rmr,
    bmi,
    tsfPercent,
    bodyAge
  } = req.body;

  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }

  // Update Current Body Composition
  if (weight) customer.bodyComposition.weight = Number(weight);
  if (fatPercent) customer.bodyComposition.fatPercent = Number(fatPercent);
  if (visceralFat) customer.bodyComposition.visceralFat = Number(visceralFat);
  if (muscleMassPercent) customer.bodyComposition.muscleMassPercent = Number(muscleMassPercent);
  if (rmr) customer.bodyComposition.rmr = Number(rmr);
  if (bmi) customer.bodyComposition.bmi = Number(bmi);
  if (tsfPercent) customer.bodyComposition.tsfPercent = Number(tsfPercent);
  if (bodyAge) customer.bodyComposition.bodyAge = Number(bodyAge);

  // Recalculate Target
  const current = customer.bodyComposition;
  const ideal = customer.idealBodyComposition;
  
  if (ideal) {
    const target = {};
    for (const key in current) {
      if (current[key] !== undefined && ideal[key] !== undefined && !isNaN(current[key]) && !isNaN(ideal[key])) {
        target[key] = (current[key] - ideal[key]).toFixed(2);
      }
    }
    customer.targetBodyComposition = target;
  }

  // Add to Progress Logs
  customer.progressLogs.push({
    date: Date.now(),
    weight: Number(weight),
    fatPercent: Number(fatPercent),
    visceralFat: Number(visceralFat),
    muscleMassPercent: Number(muscleMassPercent),
    rmr: Number(rmr),
    bmi: Number(bmi),
    tsfPercent: Number(tsfPercent),
    bodyAge: Number(bodyAge)
  });

  const updatedCustomer = await customer.save();
  res.json(updatedCustomer);
});

// @desc    Renew membership
// @route   POST /api/coach/customers/:id/renew
// @access  Private/Coach
const renewMembership = asyncHandler(async (req, res) => {
  const { pack, packPrice } = req.body;

  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }

  customer.pack = pack;
  customer.packPrice = Number(packPrice);
  customer.lastRenewalDate = Date.now();
  customer.status = 'active'; // Reactivate if they were inactive

  const updatedCustomer = await customer.save();
  res.json(updatedCustomer);
});



// @desc    Get Network Leads (Team Accountability)
// @route   GET /api/coach/network-leads
// @access  Private (Coach)
const getNetworkLeads = asyncHandler(async (req, res) => {
  const coach = await Coach.findOne({ user: req.user._id });
  if (!coach) {
    res.status(404);
    throw new Error('Coach profile not found');
  }

  // 1. Find all downline coaches recursively using $graphLookup
  // We need to find Coaches whose 'upline' leads back to this coach.
  // Since 'upline' stores User ID, we match on that.
  
  const pipeline = [
    { $match: { user: req.user._id } }, // Start with current coach
    {
      $graphLookup: {
        from: 'coaches', // Collection name (lowercase plural)
        startWith: '$user', // Start with current coach's User ID
        connectFromField: 'user', // Match this User ID...
        connectToField: 'upline', // ...to the 'upline' field of other coaches
        as: 'downlineHierarchy',
        depthField: 'level'
      }
    }
  ];

  const result = await Coach.aggregate(pipeline);
  
  let downlineCoachIds = [];
  if (result.length > 0 && result[0].downlineHierarchy) {
      downlineCoachIds = result[0].downlineHierarchy.map(c => c._id);
  }

  // 2. Fetch Leads/Trials for these coaches
  const leads = await Customer.find({
      coach: { $in: downlineCoachIds },
      status: { $in: ['lead', 'trial'] }
  }).populate('coach', 'name mobile'); // Get Coach details

  res.json(leads);
});

// @desc    Delete Customer
// @route   DELETE /api/coach/customers/:id
// @access  Private (Coach)
const deleteCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }

  // Verify coach owns this customer
  const coach = await Coach.findOne({ user: req.user._id });
  if (customer.coach.toString() !== coach._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to delete this customer');
  }

  await customer.deleteOne();
  res.json({ message: 'Customer removed' });
});

// @desc    Add Payment (Khata Book)
// @route   POST /api/coach/customers/:id/payment
// @access  Private (Coach)
const addPayment = asyncHandler(async (req, res) => {
  const { amount, date, type, notes } = req.body;
  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }

  // Verify coach owns this customer
  const coach = await Coach.findOne({ user: req.user._id });
  if (customer.coach.toString() !== coach._id.toString()) {
    res.status(401);
    throw new Error('Not authorized');
  }

  const payment = {
    amount,
    date: date || Date.now(),
    type: type || 'Cash',
    notes
  };

  customer.payments.push(payment);
  await customer.save();

  res.status(201).json(customer);
});

// @desc    Assign Food to Multiple Clients
// @route   POST /api/coach/assign-food
// @access  Private (Coach)
const assignFoodToClients = asyncHandler(async (req, res) => {
  const { foodId, clientIds, type } = req.body; // type: 'recommended' or 'avoid'

  if (!foodId || !clientIds || !Array.isArray(clientIds) || !type) {
    res.status(400);
    throw new Error('Please provide foodId, clientIds (array), and type');
  }

  // Verify coach owns these customers
  const coach = await Coach.findOne({ user: req.user._id });
  if (!coach) {
    res.status(404);
    throw new Error('Coach profile not found');
  }

  // Update operation
  const updateOps = clientIds.map(clientId => {
    const update = {};
    if (type === 'recommended') {
      update.$addToSet = { 'dietPlan.recommended': foodId };
      update.$pull = { 'dietPlan.avoid': foodId };
    } else if (type === 'avoid') {
      update.$addToSet = { 'dietPlan.avoid': foodId };
      update.$pull = { 'dietPlan.recommended': foodId };
    }
    
    return {
      updateOne: {
        filter: { _id: clientId, coach: coach._id }, // Ensure coach owns the client
        update: update
      }
    };
  });

  if (updateOps.length > 0) {
    await Customer.bulkWrite(updateOps);
  }

  res.json({ message: `Food assigned to ${clientIds.length} clients` });
});

module.exports = {
  getCoachProfile,
  getCoachDownlines,
  createCustomer,
  addCheckIn,
  renewMembership,
  markAttendance,
  updateCoachProfile,
  selfRegister,
  updateCustomer,
  getBusinessStats,
  getNetworkLeads,
  deleteCustomer,
  addPayment,
  assignFoodToClients
};
