const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  documentNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  socialSecurityNumber: {
    type: String,
    required: true,
    trim: true
  },
  sector: {
    type: String,
    enum: ['cocina', 'office', 'sala'],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Employee', employeeSchema);