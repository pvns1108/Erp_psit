const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const Student = require('../models/Student');
const Admin = require('../models/Admin');

// Verifies the JWT sent as "Authorization: Bearer <token>" and attaches req.user + req.userModel
const protect = asyncHandler(async (req, res, next) => {
  let token;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.split(' ')[1];
  }
  if (!token) {
    res.status(401);
    throw new Error('Not authorized — no token provided');
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role === 'admin') {
      const admin = await Admin.findById(decoded.id).select('-password');
      if (!admin) throw new Error();
      req.user = admin;
      req.userModel = 'Admin';
    } else {
      const student = await Student.findById(decoded.id).select('-password');
      if (!student) throw new Error();
      if (student.status === 'suspended') {
        res.status(403);
        throw new Error('Account suspended. Contact administration.');
      }
      req.user = student;
      req.userModel = 'Student';
    }
    next();
  } catch (err) {
    res.status(401);
    throw new Error('Not authorized — invalid or expired token');
  }
});

const adminOnly = (req, res, next) => {
  if (req.userModel !== 'Admin') {
    res.status(403);
    throw new Error('Admin access required');
  }
  next();
};

module.exports = { protect, adminOnly };
