const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, default: '' },
  category: { type: String, default: 'Academic' },
  pinned: { type: Boolean, default: false },
  postedBy: { type: String, default: 'Administration' },
  targetDepartment: { type: String, default: 'All' },
  targetYear: { type: String, default: 'All' }
}, { timestamps: true });

const assignmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: String,
  description: String,
  dueDate: Date,
  department: { type: String, default: 'All' },
  year: { type: String, default: 'All' }
}, { timestamps: true });

const placementSchema = new mongoose.Schema({
  company: { type: String, required: true },
  role: String,
  package: Number,
  eligibleDepartments: { type: String, default: 'All' },
  driveDate: Date,
  status: { type: String, default: 'Upcoming' }
}, { timestamps: true });

const notificationSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  type: { type: String, required: true }, // notice | assignment | attendance | result | fees | resume | placement
  title: String,
  message: String,
  read: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = {
  Notice: mongoose.model('Notice', noticeSchema),
  Assignment: mongoose.model('Assignment', assignmentSchema),
  Placement: mongoose.model('Placement', placementSchema),
  Notification: mongoose.model('Notification', notificationSchema)
};
