const asyncHandler = require('express-async-handler');
const Customer = require('../models/Customer');

// @desc    Get Customer Profile
// @route   GET /api/customers/me
// @access  Private (Customer)
const getCustomerProfile = asyncHandler(async (req, res) => {
  console.log('GET /api/customers/me hit');
  console.log('User ID from token:', req.user._id);
  
  const customer = await Customer.findOne({ user: req.user._id })
    .populate('dietPlan.recommended')
    .populate('dietPlan.avoid');
  console.log('Customer found:', customer ? customer._id : 'NONE');

  if (!customer) {
    res.status(404);
    throw new Error('Customer profile not found');
  }

  res.json(customer);
});

// @desc    Update Customer Profile
// @route   PUT /api/customers/me
// @access  Private (Customer)
const updateCustomerProfile = asyncHandler(async (req, res) => {
  let customer = await Customer.findOne({ user: req.user._id });

  if (!customer) {
    // If user is a manager or coach, create a customer profile for them on the fly
    if (req.user.role === 'manager' || req.user.role === 'coach') {
        customer = await Customer.create({
            user: req.user._id,
            name: req.user.name || 'Manager/Coach', // Fallback
            mobile: req.user.mobile,
            status: 'active',
            pack: 'Coach Self-Use'
        });
    } else {
        res.status(404);
        throw new Error('Customer profile not found');
    }
  }

  customer.name = req.body.name || customer.name;
  customer.age = req.body.age || customer.age;
  customer.gender = req.body.gender || customer.gender;
  customer.pack = req.body.pack || customer.pack;

  if (req.body.bodyComposition) {
    customer.bodyComposition = {
      ...customer.bodyComposition,
      ...req.body.bodyComposition
    };
  }

  const updatedCustomer = await customer.save();

  res.json(updatedCustomer);
});

module.exports = { getCustomerProfile, updateCustomerProfile };
