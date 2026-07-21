const multer = require('multer');
const path = require('path');
const fs = require('fs');

const dirs = {
  photo: path.join(__dirname, '..', 'uploads', 'photos'),
  resume: path.join(__dirname, '..', 'uploads', 'resumes'),
  certificate: path.join(__dirname, '..', 'uploads', 'certificates')
};
Object.values(dirs).forEach(d => fs.mkdirSync(d, { recursive: true }));

const allowed = {
  photo: ['image/jpeg', 'image/png', 'image/webp'],
  resume: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  certificate: ['application/pdf', 'image/jpeg', 'image/png']
};

const limits = {
  photo: 3 * 1024 * 1024,      // 3MB
  resume: 8 * 1024 * 1024,     // 8MB
  certificate: 8 * 1024 * 1024 // 8MB
};

function makeUploader(kind) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dirs[kind]),
    filename: (req, file, cb) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `${req.user ? req.user._id : 'anon'}-${unique}${path.extname(file.originalname)}`);
    }
  });
  return multer({
    storage,
    limits: { fileSize: limits[kind] },
    fileFilter: (req, file, cb) => {
      if (!allowed[kind].includes(file.mimetype)) {
        return cb(new Error(`Invalid file type for ${kind}. Allowed: ${allowed[kind].join(', ')}`));
      }
      cb(null, true);
    }
  });
}

// In-memory uploader for CSV bulk-import files (results, attendance) — parsed then discarded
const uploadCsvMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv');
    if (!ok) return cb(new Error('Only .csv files are accepted for bulk uploads'));
    cb(null, true);
  }
});

module.exports = {
  uploadPhoto: makeUploader('photo'),
  uploadResume: makeUploader('resume'),
  uploadCertificate: makeUploader('certificate'),
  uploadCsvMemory,
  dirs
};
