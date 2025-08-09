require('dotenv').config({ path: './.env' });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Routes
const authRoutes = require('./routes/authRoutes');
const meetingRoutes = require('./routes/meetingRoutes');
const reminderService = require('./services/reminderService');

// Initialize Express
const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Explicit routes for frontend pages
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login-signup.html'));
});

app.get('/login-signup.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login-signup.html'));
});

app.get('/email-verification.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'email-verification.html'));
});

// Database Connection
mongoose.connect(process.env.MONGO_URI, {
  dbName: 'MeetingScheduler',
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
})
.then(() => {
  console.log('✅ MongoDB Connected');
  
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    
    if (process.env.ENABLE_REMINDERS === 'true') {
      reminderService.start();
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    server.close(() => mongoose.connection.close(false));
  });

  process.on('SIGINT', () => {
    server.close(() => mongoose.connection.close(false));
  });
})
.catch(err => {
  console.error('❌ MongoDB Connection Error:', err);
  process.exit(1);
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not Found' });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ 
    success: false,
    error: 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});