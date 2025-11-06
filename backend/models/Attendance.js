const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  entryTime: {
    type: Date
  },
  smokingBreakStart: {
    type: Date
  },
  smokingBreakEnd: {
    type: Date
  },
  lunchBreakStart: {
    type: Date
  },
  lunchBreakEnd: {
    type: Date
  },
  exitTime: {
    type: Date
  },
  totalWorkedTime: {
    type: Number, // en minutos
    default: 0
  },
  signature: {
    type: String // Base64 de la firma
  }
});

module.exports = mongoose.model('Attendance', attendanceSchema);