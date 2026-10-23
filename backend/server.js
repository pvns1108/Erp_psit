require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const asyncHandler = require('express-async-handler');
const connectDB = require('./config/db');
const Admin = require('./models/Admin');
const { sendStoredFile } = require('./utils/fileStore');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const contentRoutes = require('./routes/contentRoutes');

const app = express();

// Render / Railway / Koyeb etc. sit behind a proxy. Without this, every visitor appears to
// come from the proxy's IP — login rate-limiting would lock out everyone at once and
// login history would show the wrong IP.
app.set('trust proxy', 1);

// =====================================
// Security & Middleware
// =====================================

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false, // Allows your frontend scripts to run
  })
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// =====================================
// Static Files
// =====================================

// Uploaded files live in MongoDB (free hosts wipe the disk on restart) — see utils/fileStore.js
app.get('/uploads/:folder(photos|resumes|certificates)/:filename', asyncHandler(async (req, res) => {
  await sendStoredFile(res, `/uploads/${req.params.folder}/${req.params.filename}`);
}));
app.use(express.static(path.join(__dirname, '..', 'public')));

// =====================================
// API Routes
// =====================================

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/admin', adminRoutes);

// Public Health Route
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'PSIT ERP API is running',
  });
});

// Protected Content Routes
app.use('/api', contentRoutes);

// =====================================
// Frontend
// =====================================

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }

  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// =====================================
// Error Handling
// =====================================

app.use(notFound);
app.use(errorHandler);

// =====================================
// Start Server
// =====================================

const PORT = process.env.PORT || 5000;

// On a fresh database (e.g. first deploy on a free host with no shell access),
// create the first admin account automatically from the SEED_ADMIN_* env vars.
async function ensureAdmin() {
  if (await Admin.countDocuments()) return;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password && process.env.NODE_ENV === 'production') {
    console.warn('⚠️  No admin account exists. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD and restart to create one.');
    return;
  }
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@psit.ac.in').toLowerCase();
  await Admin.create({
    name: process.env.SEED_ADMIN_NAME || 'Super Admin',
    email,
    password: password || 'ChangeMe@123'
  });
  console.log(`👤 Created first admin account: ${email}`);
}

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set — add it to your environment variables (see .env.example)');
  process.exit(1);
}

connectDB()
  .then(ensureAdmin)
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 PSIT ERP Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Startup failed:', err);
    process.exit(1);
  });
