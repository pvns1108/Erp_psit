const mongoose = require('mongoose');

const loginLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  userModel: { type: String, enum: ['Student', 'Admin'], required: true },
  name: String,
  studentId: String,
  loginTime: { type: Date, default: Date.now },
  logoutTime: Date,
  ip: String,
  browser: String,
  os: String,
  deviceType: String,
  userAgentRaw: String
}, { timestamps: true });

module.exports = mongoose.model('LoginLog', loginLogSchema);
