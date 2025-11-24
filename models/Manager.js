const mongoose = require('mongoose');

const managerSchema = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  upline: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  level: {
    type: String,
    enum: ['Junior', 'Senior', 'Regional', 'National'],
    default: 'Junior',
  },
  lineLevel: {
    type: String, // e.g., "Level 1", "Level 2"
    default: ''
  },
  candidateDownlines: [{
    mobile: { type: String, required: true },
    lineLevel: { type: String, required: true } // Keeping as String to allow "Level 1" etc if needed, or Number. User said "Line 3", let's stick to String or Number. Let's use String for flexibility based on previous prompt "Level 1".
  }],
  verifiedDownlines: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coach',
  }],
}, {
  timestamps: true,
});

module.exports = mongoose.model('Manager', managerSchema);
