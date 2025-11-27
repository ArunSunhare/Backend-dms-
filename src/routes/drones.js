// src/routes/drones.js
const express = require('express');

const {
  getUserDroneSpecs,
  getAllDroneSpecs,
  getDroneSpecsByCommand,
  getCommandDroneStatistics,
  updateDroneSpec,
  deleteDroneSpec,
} = require('../controllers/droneController');

const {
  authenticateToken,
  requireRole,
  requireDataCommandAccess,
  requireModifyAccess,
  requireDeleteAccess,
} = require('../middleware/auth');

const router = express.Router();

// All routes below this line require a valid JWT
router.use(authenticateToken);

/**
 * @route   GET /api/v2/drones/user/:userId
 * @desc    Get drone specs for a specific user
 * @access  Authenticated users (user-level scope handled inside controller/middleware)
 */
router.get('/user/:userId', getUserDroneSpecs);

/**
 * @route   GET /api/v2/drones/all
 * @desc    Get all drone specs (filtered by command if needed)
 * @access  SUPER_ADMIN, COMMAND_ADMIN
 */
router.get(
  '/all',
  requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']),
  requireDataCommandAccess(),
  getAllDroneSpecs
);

/**
 * @route   GET /api/v2/drones/command/:commandCode
 * @desc    Get drone specs for a specific command
 * @access  SUPER_ADMIN, COMMAND_ADMIN
 */
router.get(
  '/command/:commandCode',
  requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']),
  getDroneSpecsByCommand
);

/**
 * @route   GET /api/v2/drones/statistics/commands
 * @desc    Get aggregated drone statistics by command
 * @access  SUPER_ADMIN, COMMAND_ADMIN
 */
router.get(
  '/statistics/commands',
  requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']),
  getCommandDroneStatistics
);

/**
 * @route   PUT /api/v2/drones/:droneSpecId
 * @desc    Update drone specification
 * @access  Users with modify access (RBAC handled by requireModifyAccess)
 */
router.put(
  '/:droneSpecId',
  requireModifyAccess(),
  updateDroneSpec
);

/**
 * @route   DELETE /api/v2/drones/:droneSpecId
 * @desc    Delete drone specification
 * @access  Users with delete access (RBAC handled by requireDeleteAccess)
 */
router.delete(
  '/:droneSpecId',
  requireDeleteAccess(),
  deleteDroneSpec
);

module.exports = router;
