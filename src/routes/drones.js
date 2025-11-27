// const express = require('express');
// const { getUserDroneSpecs, getAllDroneSpecs } = require('../controllers/droneController');
// const { authenticateToken, requireRole } = require('../middleware/auth');

// const router = express.Router();

// router.get('/user/:userId', authenticateToken, getUserDroneSpecs);
// router.get('/all', authenticateToken, requireRole(['ADMINISTRATOR', 'CONTROLLER']), getAllDroneSpecs);

// module.exports = router;



// src/routes/drones.js
const express = require('express');
const { 
  getUserDroneSpecs, 
  getAllDroneSpecs,
  getDroneSpecsByCommand,
  getCommandDroneStatistics,
  updateDroneSpec,
  deleteDroneSpec
} = require('../controllers/droneController');
const { 
  authenticateToken, 
  requireRole,
  requireDataCommandAccess,
  requireModifyAccess,
  requireDeleteAccess
} = require('../middleware/auth');

const router = express.Router();

// Get user's drone specs
router.get('/user/:userId', 
  authenticateToken, 
  getUserDroneSpecs
);

// Get all drone specs (with role-based filtering)
router.get('/all', 
  authenticateToken, 
  requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']), 
  requireDataCommandAccess(),
  getAllDroneSpecs
);

// Get drone specs by command
router.get('/command/:commandCode', 
  authenticateToken, 
  requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']),
  getDroneSpecsByCommand
);

// Get drone statistics by command
router.get('/statistics/commands', 
  authenticateToken, 
  requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']),
  getCommandDroneStatistics
);

// Update drone specification
router.put('/:droneSpecId', 
  authenticateToken, 
  requireModifyAccess(),
  updateDroneSpec
);

// Delete drone specification
router.delete('/:droneSpecId', 
  authenticateToken, 
  requireDeleteAccess(),
  deleteDroneSpec
);

module.exports = router;
