const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const subjectAttendanceSchema = new mongoose.Schema({
  subject: String,
  attendance: { type: Number, default: 0 }
}, { _id: false });

const semesterResultSchema = new mongoose.Schema({
  sem: Number,
  sgpa: Number,
  marks: [{ subject: String, score: Number }]
}, { _id: false });

const projectSchema = new mongoose.Schema({
  title: String,
  description: String,
  link: String
});

const certificateSchema = new mongoose.Schema({
  title: String,
  filename: String,
  path: String,
  mimetype: String,
  size: Number,
  uploadedAt: { type: Date, default: Date.now }
});

const studentSchema = new mongoose.Schema({
  studentId: { type: String, unique: true, required: true }, // e.g. PSIT/CSE/22045
  registrationNumber: { type: String, unique: true, sparse: true, trim: true }, // separate university reg. no., optional
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, default: '' },
  password: { type: String, required: true },
  mustChangePassword: { type: Boolean, default: true },

  department: { type: String, required: true },
  course: { type: String, default: 'B.Tech' },
  year: { type: Number, default: 1 },
  semester: { type: Number, default: 1 }, // 1-8, distinct from admission "year"
  admissionYear: { type: Number, default: () => new Date().getFullYear() },
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ['Male', 'Female', 'Other', ''], default: '' },
  bloodGroup: { type: String, default: '' },
  category: { type: String, default: '' }, // General/OBC/SC/ST/EWS etc.
  section: { type: String, default: 'A' },
  rollNumber: { type: String, default: '' },

  profilePhoto: { type: String, default: '' },

  cgpa: { type: Number, default: 0 },
  results: [semesterResultSchema],
  attendance: [subjectAttendanceSchema],

  feesDue: { type: Number, default: 0 },
  feesPaid: { type: Number, default: 0 },

  hostelStatus: {
    allotted: { type: Boolean, default: false },
    block: String,
    room: String
  },
  busRoute: { type: String, default: '' },

  resume: {
    filename: String,
    path: String,
    mimetype: String,
    uploadedAt: Date,
    approved: { type: Boolean, default: false }
  },
  certificates: [certificateSchema],

  skills: [{ type: String }],
  projects: [projectSchema],
  achievements: [{ type: String }],
  socialLinks: {
    linkedin: { type: String, default: '' },
    github: { type: String, default: '' },
    portfolio: { type: String, default: '' }
  },
  address: {
    line1: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' }
  },
  emergencyContact: {
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    relation: { type: String, default: '' }
  },
  parentDetails: {
    fatherName: { type: String, default: '' },
    motherName: { type: String, default: '' },
    contact: { type: String, default: '' }
  },

  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  role: { type: String, default: 'student' },

  lastLogin: Date,
  passwordResetToken: String,
  passwordResetExpires: Date
}, { timestamps: true });

studentSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

studentSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

studentSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

module.exports = mongoose.model('Student', studentSchema);
