// const express = require('express');
// const { register, login } = require('../controllers/authController');

// const router = express.Router();

// router.post('/register', register);
// router.post('/login', login);

// module.exports = router;


// src/routes/auth.js
const express = require('express');
const { 
  register, 
  login, 
  createCommandAdmin, 
  getCommands, 
  updateUserRole 
} = require('../controllers/authController');
const { 
  authenticateToken, 
  requireSuperAdmin 
} = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/create-admin', authenticateToken, requireSuperAdmin(), createCommandAdmin);
router.get('/commands', authenticateToken, getCommands);
router.put('/users/:userId/role', authenticateToken, requireSuperAdmin(), updateUserRole);

module.exports = router;