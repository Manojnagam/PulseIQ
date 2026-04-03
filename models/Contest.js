const mongoose = require('mongoose');

const participantSchema = mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  coach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coach',
    required: true,
  },
  startMetrics: {
    weight: Number,
    fatPercent: Number,
    muscleMassPercent: Number,
    visceralFat: Number,
    date: Date,
    proofUrl: String,
    proofType: {
      type: String,
      enum: ['image', 'video'],
    },
  },
  currentMetrics: {
    weight: Number,
    fatPercent: Number,
    muscleMassPercent: Number,
    visceralFat: Number,
    date: Date,
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
});

const contestSchema = mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['fat-loss', 'muscle-gain', 'weight-loss'],
    required: true,
  },
  description: {
    type: String,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Manager',
    required: true,
  },
  participants: [participantSchema],
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Contest', contestSchema);
