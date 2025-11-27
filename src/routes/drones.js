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

// src/routes/drones.js → sirf ye route replace kar de

router.get('/all', 
  authenticateToken, 
  requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']), 
  async (req, res) => {
    try {
      // Pagination
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 100, 5000);
      const offset = (page - 1) * limit;

      // Optional filters
      const search = req.query.search ? `%${req.query.search}%` : null;
      const command = req.query.command || null;

      // Build query
      let sql = `
        SELECT ds.*, u.username, u.role, u.command, u.commandName 
        FROM drone_specs ds
        JOIN users u ON ds.user_id = u.id
        WHERE 1=1
      `;
      const params = [];

      if (search) {
        sql += ` AND (ds.droneName LIKE ? OR u.username LIKE ?)`;
        params.push(search, search);
      }
      if (command) {
        sql += ` AND u.command = ?`;
        params.push(command);
      }

      // Count query
      const countSql = sql.replace('SELECT ds.*, u.username, u.role, u.command, u.commandName', 'SELECT COUNT(*) as total');
      
      sql += ` ORDER BY ds.createdAt DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const [rows] = await require('../config/database').execute(sql, params);
      const [[{ total }]] = await require('../config/database').execute(countSql, params);

      res.json({
        success: true,
        data: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });

    } catch (err) {
      console.error('Drone all error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
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
