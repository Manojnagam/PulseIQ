const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    // required: true, // Made optional for walk-in customers added by coach
    // unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  mobile: {
    type: String,
    required: true,
    unique: true,
  },
  coach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coach',
  },
  // Personal Details
  age: Number,
  gender: String,
  referrer: String,
  referrerMobile: String,
  
  // Membership Details
  date: {
    type: Date,
    default: Date.now
  },
  pack: {
    type: String,
    enum: ['30 Days Shake Pack', '26 Days Shake Pack', '3 Days Trial Pack', 'Hot Drink Pack (30 Days)', 'Coach Self-Use'],
  },
  packPrice: Number,
  status: {
    type: String,
    enum: ['active', 'inactive', 'trial', 'lead'],
    default: 'active',
  },
  pipelineStage: {
    type: String,
    enum: ['New', 'Contacted', 'Trial', 'Converted', 'Lost'],
    default: 'New'
  },
  notes: {
    type: String,
    default: ''
  },
  followUp: {
    day1: { type: Boolean, default: false },
    day2: { type: Boolean, default: false },
    day3: { type: Boolean, default: false }
  },

  // Body Composition
  bodyComposition: {
    height: Number,
    weight: Number,
    fatPercent: Number,
    visceralFat: Number,
    rmr: Number, // Resting Metabolic Rate
    bmi: Number,
    bodyAge: Number,
    tsfPercent: Number, // Total Subcutaneous Fat
    muscleMassPercent: Number,
  },
  idealBodyComposition: {
    height: Number,
    weight: Number,
    fatPercent: Number,
    visceralFat: Number,
    rmr: Number,
    bmi: Number,
    bodyAge: Number,
    tsfPercent: Number,
    muscleMassPercent: Number,
  },
  targetBodyComposition: {
    height: Number,
    weight: Number,
    fatPercent: Number,
    visceralFat: Number,
    rmr: Number,
    bmi: Number,
    bodyAge: Number,
    tsfPercent: Number,
    muscleMassPercent: Number,
  },

  // Progress History
  progressLogs: [{
    date: { type: Date, default: Date.now },
    weight: Number,
    fatPercent: Number,
    visceralFat: Number,
    muscleMassPercent: Number,
    rmr: Number,
    bmi: Number,
    bodyAge: Number,
    tsfPercent: Number,
  }],

  // Membership Renewal
  lastRenewalDate: {
    type: Date
  },

  // Attendance
  attendance: [{
    type: Date
  }],

  // Payments (Khata Book)
  payments: [{
    amount: Number,
    date: { type: Date, default: Date.now },
    type: { type: String, enum: ['Cash', 'UPI', 'Bank Transfer', 'Other'], default: 'Cash' },
    notes: String
  }],

  // Personalized Diet Plan
  dietPlan: {
    recommended: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FoodItem' }],
    avoid: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FoodItem' }]
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Customer', customerSchema);
