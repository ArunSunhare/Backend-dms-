// const express = require('express');
// const { getAllUsers, getUserById } = require('../controllers/userController');
// const { authenticateToken, requireRole } = require('../middleware/auth');

// const router = express.Router();

// router.get('/', authenticateToken, requireRole(['ADMINISTRATOR', 'CONTROLLER']), getAllUsers);
// router.get('/:userId', authenticateToken, getUserById);

// module.exports = router;



const express = require('express');
const { 
  getAllUsers, 
  getUserById, 
  getUsersByCommand,
  getCommandStatistics,
  updateUserStatus,
  getUserProfile
} = require('../controllers/userController');
const { 
  authenticateToken, 
  requireRole,
  requireCommandAccess,
  requireDataCommandAccess,
  requireModifyAccess
} = require('../middleware/auth');

const router = express.Router();

// Get all users (with role-based filtering)
router.get('/', 
  authenticateToken, 
  requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']), 
  requireDataCommandAccess(),
  getAllUsers
);

// Get users by specific command
router.get('/command/:commandCode', 
  authenticateToken, 
  requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']),
  getUsersByCommand
);

// Get command statistics
router.get('/statistics/commands', 
  authenticateToken, 
  requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']),
  getCommandStatistics
);

// Get current user profile
router.get('/profile', 
  authenticateToken, 
  getUserProfile
);

// Get specific user
router.get('/:userId', 
  authenticateToken, 
  getUserById
);

// Update user status (activate/deactivate)
router.put('/:userId/status', 
  authenticateToken, 
  requireModifyAccess(),
  updateUserStatus
);

module.exports = router;