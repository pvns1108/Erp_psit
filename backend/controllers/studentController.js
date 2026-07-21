const asyncHandler = require('express-async-handler');
const fs = require('fs');
const path = require('path');
const Student = require('../models/Student');
const { Notification } = require('../models/Misc');
const { generateDocumentPdf } = require('../utils/pdfGenerator');

// GET /api/students/me
const getMe = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user._id);
  res.json({ success: true, student: student.toSafeObject() });
});

// PUT /api/students/me — updates editable profile fields
const EDITABLE_FIELDS = [
  'name', 'phone', 'address', 'socialLinks', 'emergencyContact', 'parentDetails',
  'skills', 'projects', 'achievements'
];
const updateMe = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user._id);
  EDITABLE_FIELDS.forEach(field => {
    if (req.body[field] !== undefined) student[field] = req.body[field];
  });
  await student.save();
  res.json({ success: true, message: 'Profile updated successfully', student: student.toSafeObject() });
});

// PUT /api/students/me/email { email }
const updateEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) { res.status(400); throw new Error('A valid email is required'); }
  const exists = await Student.findOne({ email: email.toLowerCase(), _id: { $ne: req.user._id } });
  if (exists) { res.status(409); throw new Error('This email is already in use'); }
  const student = await Student.findById(req.user._id);
  student.email = email.toLowerCase();
  await student.save();
  res.json({ success: true, message: 'Email updated successfully', email: student.email });
});

// --- Photo ---
const uploadPhoto = asyncHandler(async (req, res) => {
  if (!req.file) { res.status(400); throw new Error('No photo uploaded'); }
  const student = await Student.findById(req.user._id);
  if (student.profilePhoto) {
    const old = path.join(__dirname, '..', student.profilePhoto);
    fs.unlink(old, () => {});
  }
  student.profilePhoto = `/uploads/photos/${req.file.filename}`;
  await student.save();
  res.json({ success: true, message: 'Photo uploaded', profilePhoto: student.profilePhoto });
});

const removePhoto = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user._id);
  if (student.profilePhoto) {
    fs.unlink(path.join(__dirname, '..', student.profilePhoto), () => {});
  }
  student.profilePhoto = '';
  await student.save();
  res.json({ success: true, message: 'Photo removed' });
});

// --- Resume ---
const uploadResume = asyncHandler(async (req, res) => {
  if (!req.file) { res.status(400); throw new Error('No resume file uploaded'); }
  const student = await Student.findById(req.user._id);
  if (student.resume && student.resume.path) {
    fs.unlink(path.join(__dirname, '..', student.resume.path), () => {});
  }
  student.resume = {
    filename: req.file.originalname,
    path: `/uploads/resumes/${req.file.filename}`,
    mimetype: req.file.mimetype,
    uploadedAt: new Date(),
    approved: false
  };
  await student.save();
  await Notification.create({
    student: student._id, type: 'resume', title: 'Resume uploaded',
    message: 'Your resume was uploaded and is pending review by the placement cell.'
  });
  res.json({ success: true, message: 'Resume uploaded successfully', resume: student.resume });
});

const deleteResume = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user._id);
  if (student.resume && student.resume.path) {
    fs.unlink(path.join(__dirname, '..', student.resume.path), () => {});
  }
  student.resume = undefined;
  await student.save();
  res.json({ success: true, message: 'Resume deleted' });
});

const downloadResume = asyncHandler(async (req, res) => {
  const student = req.params.studentId
    ? await Student.findOne({ studentId: req.params.studentId })
    : await Student.findById(req.user._id);
  if (!student || !student.resume || !student.resume.path) { res.status(404); throw new Error('No resume on file'); }
  const filePath = path.join(__dirname, '..', student.resume.path);
  res.download(filePath, student.resume.filename);
});

// --- Certificates ---
const uploadCertificate = asyncHandler(async (req, res) => {
  if (!req.file) { res.status(400); throw new Error('No certificate file uploaded'); }
  const student = await Student.findById(req.user._id);
  student.certificates.push({
    title: req.body.title || req.file.originalname,
    filename: req.file.originalname,
    path: `/uploads/certificates/${req.file.filename}`,
    mimetype: req.file.mimetype,
    size: req.file.size
  });
  await student.save();
  res.json({ success: true, message: 'Certificate uploaded', certificates: student.certificates });
});

const deleteCertificate = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user._id);
  const cert = student.certificates.id(req.params.certId);
  if (!cert) { res.status(404); throw new Error('Certificate not found'); }
  fs.unlink(path.join(__dirname, '..', cert.path), () => {});
  cert.deleteOne();
  await student.save();
  res.json({ success: true, message: 'Certificate deleted', certificates: student.certificates });
});

const downloadCertificate = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user._id);
  const cert = student.certificates.id(req.params.certId);
  if (!cert) { res.status(404); throw new Error('Certificate not found'); }
  res.download(path.join(__dirname, '..', cert.path), cert.filename);
});

// --- Notifications ---
const getNotifications = asyncHandler(async (req, res) => {
  const notes = await Notification.find({ student: req.user._id }).sort('-createdAt').limit(50);
  res.json({ success: true, notifications: notes });
});
const markNotificationRead = asyncHandler(async (req, res) => {
  await Notification.findOneAndUpdate({ _id: req.params.id, student: req.user._id }, { read: true });
  res.json({ success: true });
});
const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ student: req.user._id, read: false }, { read: true });
  res.json({ success: true });
});

// --- Document downloads (PDFs) ---
const downloadMarksheet = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user._id);
  const sem = student.results.find(r => String(r.sem) === String(req.params.sem));
  if (!sem) { res.status(404); throw new Error('Semester result not found'); }
  generateDocumentPdf(res, `Marksheet_Sem${sem.sem}_${student.studentId.replace(/\//g, '-')}.pdf`, {
    title: `Semester ${sem.sem} Marksheet`,
    subtitle: `${student.name} · ${student.studentId} · ${student.department}`,
    rows: [
      ...sem.marks.map(m => [m.subject, `${m.score}%`]),
      ['SGPA', String(sem.sgpa)]
    ]
  });
});

const downloadTranscript = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user._id);
  generateDocumentPdf(res, `Transcript_${student.studentId.replace(/\//g, '-')}.pdf`, {
    title: 'Academic Transcript',
    subtitle: `${student.name} · ${student.studentId} · ${student.department}`,
    rows: [
      ...student.results.map(r => [`Semester ${r.sem}`, `${r.sgpa} SGPA`]),
      ['Cumulative CGPA', String(student.cgpa)]
    ]
  });
});

const downloadFeeReceipt = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user._id);
  generateDocumentPdf(res, `Fee_Receipt_${student.studentId.replace(/\//g, '-')}.pdf`, {
    title: 'Fee Payment Receipt',
    subtitle: `${student.name} · ${student.studentId}`,
    rows: [
      ['Fees Paid', `₹${student.feesPaid.toLocaleString('en-IN')}`],
      ['Fees Due', `₹${student.feesDue.toLocaleString('en-IN')}`],
      ['Academic Year', new Date().getFullYear().toString()]
    ]
  });
});

const downloadBonafide = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user._id);
  generateDocumentPdf(res, `Bonafide_Certificate_${student.studentId.replace(/\//g, '-')}.pdf`, {
    title: 'Bonafide Certificate',
    paragraphs: [
      `This is to certify that ${student.name} (Student ID: ${student.studentId}, Roll No: ${student.rollNumber || 'N/A'}) is a bonafide student of Pranveer Singh Institute of Technology, Kanpur, currently enrolled in ${student.course} (${student.department}), Year ${student.year}, Section ${student.section}.`,
      'This certificate is issued upon request for official purposes.'
    ]
  });
});

const downloadAttendanceReport = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user._id);
  generateDocumentPdf(res, `Attendance_Report_${student.studentId.replace(/\//g, '-')}.pdf`, {
    title: 'Attendance Report',
    subtitle: `${student.name} · ${student.studentId}`,
    rows: student.attendance.map(a => [a.subject, `${a.attendance}%`])
  });
});

const downloadAdmitCard = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user._id);
  generateDocumentPdf(res, `Admit_Card_${student.studentId.replace(/\//g, '-')}.pdf`, {
    title: 'Examination Admit Card',
    subtitle: `${student.name} · ${student.studentId}`,
    rows: [
      ['Department', student.department],
      ['Course', student.course],
      ['Year / Section', `${student.year} / ${student.section}`],
      ['Roll Number', student.rollNumber || 'N/A']
    ],
    footer: 'Carry this admit card along with your college ID to the examination hall.'
  });
});

const downloadProfilePdf = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user._id);
  generateDocumentPdf(res, `Profile_${student.studentId.replace(/\//g, '-')}.pdf`, {
    title: 'Student Profile',
    subtitle: `${student.name} · ${student.studentId}`,
    rows: [
      ['Email', student.email],
      ['Phone', student.phone || 'N/A'],
      ['Department', student.department],
      ['Course / Year / Section', `${student.course} / ${student.year} / ${student.section}`],
      ['CGPA', String(student.cgpa)],
      ['Skills', (student.skills || []).join(', ') || 'N/A']
    ]
  });
});

module.exports = {
  getMe, updateMe, updateEmail,
  uploadPhoto, removePhoto,
  uploadResume, deleteResume, downloadResume,
  uploadCertificate, deleteCertificate, downloadCertificate,
  getNotifications, markNotificationRead, markAllNotificationsRead,
  downloadMarksheet, downloadTranscript, downloadFeeReceipt,
  downloadBonafide, downloadAttendanceReport, downloadAdmitCard, downloadProfilePdf
};
