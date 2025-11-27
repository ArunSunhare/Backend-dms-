// const express = require('express');
// const {
//   getAllFlights,
//   getFlightWaypoints,
//   createFlight,
//   updateFlight,
//   requestCancelFlight,
//   deleteFlight
// } = require('../controllers/flightController');
// const { authenticateToken, requireRole } = require('../middleware/auth');

// const router = express.Router();

// router.get('/', authenticateToken, getAllFlights);
// router.get('/:flightId/waypoints', authenticateToken, getFlightWaypoints);
// router.post('/', authenticateToken, createFlight);
// router.put('/:flightId', authenticateToken, updateFlight);
// router.post('/:flightId/cancel', authenticateToken, requestCancelFlight);
// router.delete('/:flightId', authenticateToken, requireRole(['ADMINISTRATOR', 'CONTROLLER']), deleteFlight);

// module.exports = router;



// src/routes/flights.js
const express = require('express');
const {
  getAllFlights,
  getFlightsByCommand,
  getFlightWaypoints,
  createFlight,
  updateFlight,
  requestCancelFlight,
  deleteFlight,
  approveFlight,
  getFlightStatistics
} = require('../controllers/flightController');
const { 
  authenticateToken, 
  requireRole,
  requireDataCommandAccess,
  requireModifyAccess,
  requireDeleteAccess,
  validateCommandOperation
} = require('../middleware/auth');

const router = express.Router();

// Get all flights (with role-based filtering)
router.get('/', 
  authenticateToken, 
  requireDataCommandAccess(),
  getAllFlights
);

// Get flights by command
router.get('/command/:commandCode', 
  authenticateToken, 
  requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']),
  getFlightsByCommand
);

// Get flight statistics
router.get('/statistics', 
  authenticateToken, 
  requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']),
  getFlightStatistics
);

// Get flight waypoints
router.get('/:flightId/waypoints', 
  authenticateToken, 
  getFlightWaypoints
);

// Create new flight
router.post('/', 
  authenticateToken, 
  validateCommandOperation(),
  createFlight
);

// Update flight
router.put('/:flightId', 
  authenticateToken, 
  updateFlight
);

// Request flight cancellation
router.post('/:flightId/cancel', 
  authenticateToken, 
  requestCancelFlight
);

// Approve flight (admins only)
router.post('/:flightId/approve', 
  authenticateToken, 
  requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']),
  approveFlight
);

// Delete flight (admins only)
router.delete('/:flightId', 
  authenticateToken, 
  requireDeleteAccess(),
  deleteFlight
);

module.exports = router;