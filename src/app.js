// 


// src/app.js
const express = require('express');
const cors = require('cors');
const os = require('os');
require('dotenv').config();

const { initializeDatabase } = require('./config/database');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const droneRoutes = require('./routes/drones');
const flightRoutes = require('./routes/flights');
const commandRoutes = require('./routes/commands');

const app = express();

// ========================
// Middleware
// ========================
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8081/',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const userInfo = req.user ? ` | User: ${req.user.username} (${req.user.role})` : '';
  console.log(`${timestamp} - ${req.method} ${req.path}${userInfo}`);
  next();
});

// ========================
// Routes
// ========================
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/drones', droneRoutes);
app.use('/api/flights', flightRoutes);
app.use('/api/commands', commandRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '2.0.0-rbac',
    uptime: process.uptime().toFixed(2) + 's',
    features: {
      roleBasedAccess: true,
      commandIsolation: true,
      multiTenancy: true
    }
  });
});

// API Info
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Drone Management System API',
    version: '2.0.0-rbac',
    description: 'Secure drone fleet management with role-based access control',
    supportedRoles: ['SUPER_ADMIN', 'COMMAND_ADMIN', 'CONTROLLER', 'OPERATOR'],
    supportedCommands: ['ec', 'wc', 'sc', 'nc', 'swc', 'anc'],
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      drones: '/api/drones',
      flights: '/api/flights',
      commands: '/api/commands',
      health: '/api/health',
      info: '/api/info'
    }
  });
});

// Development-only: Test roles endpoint
if (process.env.NODE_ENV === 'development') {
  app.get('/api/test/roles', async (req, res) => {
    const { pool } = require('./config/database');
    try {
      const [users] = await pool.execute(`
        SELECT username, role, assigned_command, can_access_all_commands 
        FROM users 
        ORDER BY role, username
      `);

      const roleDistribution = users.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {});

      res.json({
        totalUsers: users.length,
        roleDistribution,
        users: users.map(u => ({
          username: u.username,
          role: u.role,
          command: u.assigned_command,
          allCommands: !!u.can_access_all_commands
        }))
      });
    } catch (error) {
      console.error('Role test error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });
}

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available: [
      '/api/health', '/api/info', '/api/auth', '/api/users',
      '/api/drones', '/api/flights', '/api/commands'
    ]
  });
});

// Global Error Handler
app.use((error, req, res, next) => {
  console.error('Unhandled Error:', error);

  const isDev = process.env.NODE_ENV === 'development';
  res.status(error.status || 500).json({
    message: error.message || 'Internal Server Error',
    ...(isDev && { stack: error.stack }),
    timestamp: new Date().toISOString()
  });
});

// ========================
// Server Startup with Beautiful Logs
// ========================
const PORT = process.env.PORT || 5000;

// Get local network IP
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

async function startServer() {
  try {
    console.log('Starting Drone Management System API v2.0.0 (RBAC + Command Isolation)\n');
    
    await initializeDatabase();
    console.log('Database connected and initialized\n');

    const localIp = getLocalIp();

    app.listen(PORT, '0.0.0.0', () => {
      console.log('Server is LIVE!');
      console.log('══════════════════════════════════════════════════════════');
      console.log(`   Local:            http://localhost:${PORT}`);
      console.log(`   Network (LAN):     http://${localIp}:${PORT}`);
      console.log('');
      console.log(`   Health Check → http://localhost:${PORT}/api/health`);
      console.log(`   API Docs     → http://localhost:${PORT}/api/info`);
      if (process.env.NODE_ENV === 'development') {
        console.log(`   Test Roles   → http://localhost:${PORT}/api/test/roles`);
      }
      console.log('');
      console.log('Ready for:');
      console.log(`   • Mobile devices on WiFi → http://${localIp}:${PORT}`);
      console.log(`   • Frontend on another PC → use http://${localIp}:${PORT}`);
      console.log(`   • Public access          → run: ngrok http ${PORT}`);
      console.log('══════════════════════════════════════════════════════════\n');
      
      console.log('Role-based access control ACTIVE');
      console.log('Command isolation enabled\n');
    });

  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
['SIGTERM', 'SIGINT'].forEach(signal => {
  process.on(signal, () => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    process.exit(0);
  });
});

// Start the server
startServer();
