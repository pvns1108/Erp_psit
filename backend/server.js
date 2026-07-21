require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const contentRoutes = require('./routes/contentRoutes');

const app = express();

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

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
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

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 PSIT ERP Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database connection failed:', err);
  });