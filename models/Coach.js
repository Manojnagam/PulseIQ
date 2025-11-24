const mongoose = require('mongoose');

const coachSchema = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
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
  age: Number,
  wellnessCenterName: String,
  uplineCoachName: String,
  uplineCoachMobile: String,
  upline: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Can be Coach or Manager
    default: null
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  // Derived/Cached stats
  totalDownlines: {
    type: Number,
    default: 0,
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Coach', coachSchema);
