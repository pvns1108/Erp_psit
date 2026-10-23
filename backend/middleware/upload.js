const multer = require('multer');
const path = require('path');
const StoredFile = require('../models/StoredFile');

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

// Files are held in memory by multer, then saved to MongoDB (see models/StoredFile.js).
// After this runs, req.file.filename is set exactly like multer's disk storage used to,
// so controllers keep building paths like `/uploads/photos/<filename>`.
function makeUploader(kind) {
  const m = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: limits[kind] },
    fileFilter: (req, file, cb) => {
      if (!allowed[kind].includes(file.mimetype)) {
        const err = new Error(`Invalid file type for ${kind}. Allowed: ${allowed[kind].join(', ')}`);
        err.status = 400;
        return cb(err);
      }
      cb(null, true);
    }
  });

  const saveToDb = async (req, res, next) => {
    try {
      if (!req.file) return next();
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const filename = `${req.user ? req.user._id : 'anon'}-${unique}${path.extname(req.file.originalname).toLowerCase()}`;
      await StoredFile.create({
        kind,
        filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        owner: req.user ? req.user._id : undefined,
        data: req.file.buffer
      });
      req.file.filename = filename;
      req.file.buffer = undefined;
      next();
    } catch (err) {
      next(err);
    }
  };

  return { single: field => [m.single(field), saveToDb] };
}

// In-memory uploader for CSV bulk-import files (results, attendance) — parsed then discarded
const uploadCsvMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv');
    if (!ok) {
      const err = new Error('Only .csv files are accepted for bulk uploads');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  }
});

module.exports = {
  uploadPhoto: makeUploader('photo'),
  uploadResume: makeUploader('resume'),
  uploadCertificate: makeUploader('certificate'),
  uploadCsvMemory
};
