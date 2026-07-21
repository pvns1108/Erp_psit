const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const Student = require('../models/Student');
const Admin = require('../models/Admin');
const LoginLog = require('../models/LoginLog');
const { signToken, generateResetToken, parseRequestMeta } = require('../utils/helpers');

// POST /api/auth/student-login  { identifier (studentId or email), password }
const studentLogin = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    res.status(400); throw new Error('Student ID/email and password are required');
  }
  const student = await Student.findOne({
    $or: [{ studentId: identifier }, { email: identifier.toLowerCase() }, { rollNumber: identifier }, { registrationNumber: identifier }]
  });
  if (!student) { res.status(401); throw new Error('Invalid credentials'); }
  if (student.status === 'suspended') { res.status(403); throw new Error('This account has been suspended. Contact administration.'); }

  const match = await student.comparePassword(password);
  if (!match) { res.status(401); throw new Error('Invalid credentials'); }

  student.lastLogin = new Date();
  await student.save();

  const meta = parseRequestMeta(req);
  const log = await LoginLog.create({
    userId: student._id, userModel: 'Student', name: student.name, studentId: student.studentId,
    ...meta
  });

  res.json({
    success: true,
    token: signToken(student._id, 'student'),
    logId: log._id,
    mustChangePassword: student.mustChangePassword,
    user: student.toSafeObject()
  });
});

// POST /api/auth/admin-login { email, password }
const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400); throw new Error('Email and password are required'); }
  const admin = await Admin.findOne({ email: email.toLowerCase() });
  if (!admin) { res.status(401); throw new Error('Invalid credentials'); }
  const match = await admin.comparePassword(password);
  if (!match) { res.status(401); throw new Error('Invalid credentials'); }

  admin.lastLogin = new Date();
  await admin.save();

  const meta = parseRequestMeta(req);
  const log = await LoginLog.create({
    userId: admin._id, userModel: 'Admin', name: admin.name, studentId: '—', ...meta
  });

  res.json({
    success: true,
    token: signToken(admin._id, 'admin'),
    logId: log._id,
    user: { _id: admin._id, name: admin.name, email: admin.email, role: 'admin' }
  });
});

// POST /api/auth/logout { logId }
const logout = asyncHandler(async (req, res) => {
  const { logId } = req.body;
  if (logId) {
    await LoginLog.findByIdAndUpdate(logId, { logoutTime: new Date() });
  }
  res.json({ success: true, message: 'Logged out' });
});

// POST /api/auth/change-password (protected) { currentPassword, newPassword }
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    res.status(400); throw new Error('New password must be at least 6 characters');
  }
  const Model = req.userModel === 'Admin' ? Admin : Student;
  const user = await Model.findById(req.user._id);
  const match = await user.comparePassword(currentPassword);
  if (!match) { res.status(401); throw new Error('Current password is incorrect'); }
  user.password = newPassword;
  if (req.userModel === 'Student') user.mustChangePassword = false;
  await user.save();
  res.json({ success: true, message: 'Password changed successfully' });
});

// POST /api/auth/forgot-password { identifier } — student or admin email/studentId
const forgotPassword = asyncHandler(async (req, res) => {
  const { identifier } = req.body;
  if (!identifier) { res.status(400); throw new Error('Email or Student ID is required'); }

  let user = await Student.findOne({ $or: [{ studentId: identifier }, { email: identifier.toLowerCase() }, { rollNumber: identifier }, { registrationNumber: identifier }] });
  let Model = Student;
  if (!user) {
    user = await Admin.findOne({ email: identifier.toLowerCase() });
    Model = Admin;
  }
  // Always respond success (don't leak account existence)
  if (!user) {
    return res.json({ success: true, message: 'If an account exists, a reset link has been generated.' });
  }
  const { token, hashed } = generateResetToken();
  user.passwordResetToken = hashed;
  user.passwordResetExpires = Date.now() + 1000 * 60 * 30; // 30 min
  await user.save();

  // NOTE: no SMTP configured in this demo — the reset link/token is returned directly.
  // In production, email this link via nodemailer/SES/SendGrid instead of returning it.
  res.json({
    success: true,
    message: 'Password reset token generated (dev mode — no email service configured).',
    devResetToken: token
  });
});

// POST /api/auth/reset-password { token, newPassword }
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || newPassword.length < 6) {
    res.status(400); throw new Error('Token and a new password (6+ chars) are required');
  }
  const hashed = crypto.createHash('sha256').update(token).digest('hex');
  let user = await Student.findOne({ passwordResetToken: hashed, passwordResetExpires: { $gt: Date.now() } });
  if (!user) {
    user = await Admin.findOne({ passwordResetToken: hashed, passwordResetExpires: { $gt: Date.now() } });
  }
  if (!user) { res.status(400); throw new Error('Reset token is invalid or has expired'); }

  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  if (user.mustChangePassword !== undefined) user.mustChangePassword = false;
  await user.save();
  res.json({ success: true, message: 'Password reset successfully — you can now log in.' });
});

module.exports = { studentLogin, adminLogin, logout, changePassword, forgotPassword, resetPassword };
