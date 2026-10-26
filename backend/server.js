const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/event');
const questionRoutes = require('./routes/question');
const participantRoutes = require('./routes/participant');
const submissionRoutes = require('./routes/submission');
const leaderboardRoutes = require('./routes/leaderboard');

const { initSocketHandlers } = require('./socket/handlers');

const app = express();
const server = http.createServer(app);

// Permissive CORS configuration — allows ALL origins, methods, and common headers
const corsOptions = {
  origin: (origin, callback) => {
    // Dynamically reflect requesting origin, or allow if no origin (mobile apps, Postman, curl)
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
  ],
  optionsSuccessStatus: 200,
};

// Socket.IO with all-origins allowed
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  },
  allowEIO3: true,
});

// Middleware
app.use(cors(corsOptions));

// Explicit header fallback to ensure CORS headers are present on EVERY response
app.use((req, res, next) => {
  const reqOrigin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', reqOrigin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, Access-Control-Request-Method, Access-Control-Request-Headers'
  );
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Handle preflight for all routes
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure DB connection before handling API routes
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection error in request:', err.message);
    res.status(500).json({ success: false, message: 'Database connection failed', error: err.message });
  }
});

// Make io accessible to routes/controllers
app.set('io', io);

// Health check endpoints (for Render, Railway, Vercel, Docker, uptime monitors & probes)
const healthCheckHandler = (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    ok: true,
    status: 'ok',
    message: 'Silicon Sorcerer Backend is healthy and running!',
    cors: 'all-origins-allowed (*)',
    database: isDbConnected ? 'connected' : 'connecting',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
};

app.get(['/health', '/api/health', '/ok', '/api/ok', '/ping', '/healthz'], healthCheckHandler);

// Root route
app.get('/', (req, res) => {
  res.json({
    ok: true,
    status: 'ok',
    message: '🚀 Silicon Sorcerer Backend API is live!',
    health: '/health',
    apiHealth: '/api/health',
    cors: 'all-origins-allowed (*)',
    version: '1.0.0',
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/participants', participantRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Initialize Socket.IO handlers
initSocketHandlers(io);

// Connect to MongoDB and start standalone server if run directly
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  connectDB().then(async () => {
    const Admin = require('./models/Admin');
    await Admin.createDefault().catch((e) => console.warn('Admin init note:', e.message));

    server.listen(PORT, () => {
      console.log(`\n🚀 Silicon Sorcerer Backend running on port ${PORT}`);
      console.log(`📡 Socket.IO ready`);
      console.log(`🌐 CORS: Allowed for all origins (*)\n`);
    });
  }).catch((err) => {
    console.error('Failed to connect to MongoDB on startup:', err.message);
  });
}

module.exports = app;
module.exports.app = app;
module.exports.server = server;
module.exports.io = io;
