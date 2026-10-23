const asyncHandler = require('express-async-handler');
const { parse } = require('csv-parse/sync');
const { Parser: CsvParser } = require('json2csv');
const ExcelJS = require('exceljs');
const Student = require('../models/Student');
const LoginLog = require('../models/LoginLog');
const StoredFile = require('../models/StoredFile');
const { Notice, Assignment, Placement, Notification } = require('../models/Misc');
const { generateStudentId, generateTempPassword } = require('../utils/helpers');
const { generateDocumentPdf } = require('../utils/pdfGenerator');

// Escapes user input before it's used inside a RegExp (stops crashes/ReDoS from inputs like "(" or "a+")
const escapeRegex = str => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// In-memory holder of most-recently-created credentials, for export convenience.
let recentCredentials = [];

// POST /api/admin/students  — create a single student account
const createStudent = asyncHandler(async (req, res) => {
  const {
    name, email, phone, department, course, year, semester, section, rollNumber,
    registrationNumber, dateOfBirth, gender, bloodGroup, category, admissionYear,
    address, parentName, parentContact, hostelStatus, busRoute
  } = req.body;
  if (!name || !email || !department) { res.status(400); throw new Error('Name, email and department are required'); }

  const exists = await Student.findOne({ email: email.toLowerCase() });
  if (exists) { res.status(409); throw new Error('A student with this email already exists'); }

  if (registrationNumber) {
    const regExists = await Student.findOne({ registrationNumber });
    if (regExists) { res.status(409); throw new Error('A student with this registration number already exists'); }
  }

  const studentId = generateStudentId(department, year);
  const tempPassword = generateTempPassword();

  const studentData = {
    studentId, name, email: email.toLowerCase(), phone, department,
    course: course || 'B.Tech', year: year || 1, semester: semester || 1, section: section || 'A',
    rollNumber: rollNumber || '', password: tempPassword, mustChangePassword: true,
    dateOfBirth: dateOfBirth || undefined, gender: gender || '', bloodGroup: bloodGroup || '',
    category: category || '', admissionYear: admissionYear || new Date().getFullYear(),
    busRoute: busRoute || ''
  };
  if (registrationNumber) studentData.registrationNumber = registrationNumber;
  if (address) studentData.address = address;
  if (hostelStatus) studentData.hostelStatus = hostelStatus;
  if (parentName || parentContact) {
    studentData.parentDetails = { fatherName: parentName || '', motherName: '', contact: parentContact || '' };
  }

  const student = await Student.create(studentData);

  recentCredentials.push({ studentId, name, email: student.email, tempPassword, createdAt: new Date() });

  res.status(201).json({
    success: true,
    message: 'Student account created',
    credentials: { studentId, username: student.email, tempPassword },
    student: student.toSafeObject()
  });
});

// GET /api/admin/students?search=&department=&year=&status=&page=&limit=
const listStudents = asyncHandler(async (req, res) => {
  const { search = '', department, year, status, page = 1, limit = 20 } = req.query;
  const query = {};
  if (department) query.department = department;
  if (year) query.year = Number(year);
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { name: new RegExp(escapeRegex(search), 'i') },
      { studentId: new RegExp(escapeRegex(search), 'i') },
      { email: new RegExp(escapeRegex(search), 'i') },
      { rollNumber: new RegExp(escapeRegex(search), 'i') },
      { department: new RegExp(escapeRegex(search), 'i') }
    ];
  }
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Number(limit));
  const [students, total] = await Promise.all([
    Student.find(query).select('-password').sort('-createdAt').skip((pageNum - 1) * limitNum).limit(limitNum),
    Student.countDocuments(query)
  ]);
  res.json({ success: true, students, total, page: pageNum, pages: Math.ceil(total / limitNum) });
});

const getStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id).select('-password');
  if (!student) { res.status(404); throw new Error('Student not found'); }
  res.json({ success: true, student });
});

const updateStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) { res.status(404); throw new Error('Student not found'); }
  const allowed = ['name', 'email', 'phone', 'department', 'course', 'year', 'semester', 'section', 'rollNumber',
    'registrationNumber', 'dateOfBirth', 'gender', 'bloodGroup', 'category', 'admissionYear',
    'address', 'parentDetails', 'cgpa', 'feesDue', 'feesPaid', 'hostelStatus', 'busRoute', 'status'];
  allowed.forEach(f => { if (req.body[f] !== undefined) student[f] = req.body[f]; });
  await student.save();
  res.json({ success: true, message: 'Student updated', student: student.toSafeObject() });
});

const deleteStudent = asyncHandler(async (req, res) => {
  const student = await Student.findByIdAndDelete(req.params.id);
  if (!student) { res.status(404); throw new Error('Student not found'); }
  // Clean up the student's uploaded files and notifications so they don't pile up in the free DB tier
  await StoredFile.deleteMany({ owner: student._id });
  await Notification.deleteMany({ student: student._id });
  res.json({ success: true, message: 'Student deleted' });
});

const suspendStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) { res.status(404); throw new Error('Student not found'); }
  student.status = student.status === 'suspended' ? 'active' : 'suspended';
  await student.save();
  res.json({ success: true, message: `Student ${student.status === 'suspended' ? 'suspended' : 'reactivated'}`, status: student.status });
});

const resetStudentPassword = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) { res.status(404); throw new Error('Student not found'); }
  const tempPassword = generateTempPassword();
  student.password = tempPassword;
  student.mustChangePassword = true;
  await student.save();
  recentCredentials.push({ studentId: student.studentId, name: student.name, email: student.email, tempPassword, createdAt: new Date() });
  res.json({ success: true, message: 'Password reset', credentials: { studentId: student.studentId, username: student.email, tempPassword } });
});

// GET /api/admin/credentials/export?format=csv|excel|pdf
const exportCredentials = asyncHandler(async (req, res) => {
  const format = (req.query.format || 'csv').toLowerCase();
  const rows = recentCredentials.length ? recentCredentials : [];
  if (!rows.length) { res.status(404); throw new Error('No recently generated credentials to export yet'); }

  if (format === 'csv') {
    const parser = new CsvParser({ fields: ['studentId', 'name', 'email', 'tempPassword', 'createdAt'] });
    const csv = parser.parse(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="student_credentials.csv"');
    return res.send(csv);
  }
  if (format === 'excel') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Credentials');
    sheet.columns = [
      { header: 'Student ID', key: 'studentId', width: 20 },
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Email / Username', key: 'email', width: 28 },
      { header: 'Temp Password', key: 'tempPassword', width: 18 },
      { header: 'Created At', key: 'createdAt', width: 22 }
    ];
    rows.forEach(r => sheet.addRow(r));
    sheet.getRow(1).font = { bold: true };
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="student_credentials.xlsx"');
    await workbook.xlsx.write(res);
    return res.end();
  }
  if (format === 'pdf') {
    return generateDocumentPdf(res, 'student_credentials.pdf', {
      title: 'Student Login Credentials',
      subtitle: `${rows.length} account(s) — distribute securely and require password change on first login`,
      rows: rows.map(r => [`${r.name} (${r.studentId})`, `${r.email} / ${r.tempPassword}`])
    });
  }
  res.status(400); throw new Error('format must be csv, excel, or pdf');
});

// POST /api/admin/students/bulk-results  (multipart CSV: studentId,sem,sgpa,subject,score)
const bulkUploadResults = asyncHandler(async (req, res) => {
  if (!req.file) { res.status(400); throw new Error('CSV file is required'); }
  const records = parse(req.file.buffer.toString('utf-8'), { columns: true, skip_empty_lines: true, trim: true });
  let updated = 0, notFound = 0;
  const grouped = {};
  records.forEach(r => {
    const key = `${r.studentId}__${r.sem}`;
    if (!grouped[key]) grouped[key] = { studentId: r.studentId, sem: Number(r.sem), sgpa: Number(r.sgpa), marks: [] };
    if (r.subject) grouped[key].marks.push({ subject: r.subject, score: Number(r.score) });
  });
  for (const key of Object.keys(grouped)) {
    const entry = grouped[key];
    const student = await Student.findOne({ studentId: entry.studentId });
    if (!student) { notFound++; continue; }
    const idx = student.results.findIndex(r => r.sem === entry.sem);
    if (idx >= 0) student.results[idx] = entry; else student.results.push(entry);
    const total = student.results.reduce((s, r) => s + (r.sgpa || 0), 0);
    student.cgpa = Number((total / student.results.length).toFixed(2));
    await student.save();
    await Notification.create({ student: student._id, type: 'result', title: 'Result published', message: `Semester ${entry.sem} result has been published.` });
    updated++;
  }
  res.json({ success: true, message: `Results processed: ${updated} updated, ${notFound} student ID(s) not found` });
});

// POST /api/admin/students/bulk-attendance (multipart CSV: studentId,subject,attendance)
const bulkUploadAttendance = asyncHandler(async (req, res) => {
  if (!req.file) { res.status(400); throw new Error('CSV file is required'); }
  const records = parse(req.file.buffer.toString('utf-8'), { columns: true, skip_empty_lines: true, trim: true });
  let updated = 0, notFound = 0;
  const byStudent = {};
  records.forEach(r => {
    if (!byStudent[r.studentId]) byStudent[r.studentId] = [];
    byStudent[r.studentId].push({ subject: r.subject, attendance: Number(r.attendance) });
  });
  for (const studentId of Object.keys(byStudent)) {
    const student = await Student.findOne({ studentId });
    if (!student) { notFound++; continue; }
    student.attendance = byStudent[studentId];
    await student.save();
    const low = byStudent[studentId].find(a => a.attendance < 75);
    if (low) {
      await Notification.create({ student: student._id, type: 'attendance', title: 'Attendance alert', message: `${low.subject} attendance is ${low.attendance}%, below the 75% requirement.` });
    }
    updated++;
  }
  res.json({ success: true, message: `Attendance processed: ${updated} updated, ${notFound} student ID(s) not found` });
});

// POST /api/admin/notices  { title, body, category, pinned, targetDepartment, targetYear }
const postNotice = asyncHandler(async (req, res) => {
  const notice = await Notice.create(req.body);
  const query = {};
  if (notice.targetDepartment && notice.targetDepartment !== 'All') query.department = notice.targetDepartment;
  if (notice.targetYear && notice.targetYear !== 'All') query.year = Number(notice.targetYear);
  const students = await Student.find(query).select('_id');
  await Notification.insertMany(students.map(s => ({
    student: s._id, type: 'notice', title: notice.title, message: notice.body || notice.title
  })));
  res.status(201).json({ success: true, message: `Notice posted to ${students.length} student(s)`, notice });
});

// POST /api/admin/assignments
const postAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.create(req.body);
  const query = {};
  if (assignment.department && assignment.department !== 'All') query.department = assignment.department;
  if (assignment.year && assignment.year !== 'All') query.year = Number(assignment.year);
  const students = await Student.find(query).select('_id');
  await Notification.insertMany(students.map(s => ({
    student: s._id, type: 'assignment', title: 'New assignment: ' + assignment.title, message: assignment.description || assignment.title
  })));
  res.status(201).json({ success: true, message: `Assignment posted to ${students.length} student(s)`, assignment });
});

// POST /api/admin/placements
const postPlacement = asyncHandler(async (req, res) => {
  const placement = await Placement.create(req.body);
  const query = {};
  if (placement.eligibleDepartments && placement.eligibleDepartments !== 'All') query.department = placement.eligibleDepartments;
  const students = await Student.find(query).select('_id');
  await Notification.insertMany(students.map(s => ({
    student: s._id, type: 'placement', title: `${placement.company} is hiring`, message: `${placement.role || 'Opportunity'} · ₹${placement.package || '—'} LPA`
  })));
  res.status(201).json({ success: true, message: `Placement drive posted, ${students.length} student(s) notified`, placement });
});

// GET /api/admin/login-history?page=&limit=&search=
const getLoginHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 25, search = '' } = req.query;
  const query = {};
  if (search) {
    query.$or = [{ name: new RegExp(escapeRegex(search), 'i') }, { studentId: new RegExp(escapeRegex(search), 'i') }];
  }
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Number(limit));
  const [logs, total] = await Promise.all([
    LoginLog.find(query).sort('-loginTime').skip((pageNum - 1) * limitNum).limit(limitNum),
    LoginLog.countDocuments(query)
  ]);
  res.json({ success: true, logs, total, page: pageNum, pages: Math.ceil(total / limitNum) });
});

// GET /api/admin/stats — quick dashboard numbers
const getStats = asyncHandler(async (req, res) => {
  const [totalStudents, suspended, avgAgg] = await Promise.all([
    Student.countDocuments(),
    Student.countDocuments({ status: 'suspended' }),
    Student.aggregate([{ $group: { _id: null, avgCgpa: { $avg: '$cgpa' } } }])
  ]);
  const recentLogins = await LoginLog.countDocuments({ loginTime: { $gte: new Date(Date.now() - 24 * 3600 * 1000) } });
  res.json({
    success: true,
    stats: {
      totalStudents, suspended, active: totalStudents - suspended,
      avgCgpa: avgAgg[0] ? Number(avgAgg[0].avgCgpa.toFixed(2)) : 0,
      recentLogins
    }
  });
});

module.exports = {
  createStudent, listStudents, getStudent, updateStudent, deleteStudent,
  suspendStudent, resetStudentPassword, exportCredentials,
  bulkUploadResults, bulkUploadAttendance,
  postNotice, postAssignment, postPlacement,
  getLoginHistory, getStats
};
