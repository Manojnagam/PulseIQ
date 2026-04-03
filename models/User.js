const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  mobile: {
    type: String,
    required: true,
    unique: true,
  },
  role: {
    type: String,
    enum: ['customer', 'coach', 'manager'],
    required: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  // For password fallback (optional based on blueprint, but good to have)
  password: {
    type: String,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);
