const mongoose = require('mongoose');

const resourceSchema = mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['video', 'link', 'pdf'],
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Manager',
    required: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Resource', resourceSchema);
