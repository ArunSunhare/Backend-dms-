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
// src/routes/drones.js  → Sirf yeh route replace kar de

router.get('/all',
  authenticateToken,
  requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']),
  requireDataCommandAccess(),
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 100, 5000); // max 5000 per page
      const offset = (page - 1) * limit;

      const search = req.query.search || '';
      const commandFilter = req.query.command || '';

      let query = `
        SELECT 
          ds.*, u.username, u.command, u.commandName
        FROM drone_specs ds
        JOIN users u ON ds.user_id = u.id
        WHERE 1=1
      `;
      let countQuery = `SELECT COUNT(*) as total FROM drone_specs ds JOIN users u ON ds.user_id = u.id WHERE 1=1`;
      const params = [];
      const countParams = [];

      if (search) {
        query += ` AND (ds.droneName LIKE ? OR u.username LIKE ?)`;
        countQuery += ` AND (ds.droneName LIKE ? OR u.username LIKE ?)`;
        const like = `%${search}%`;
        params.push(like, like);
        countParams.push(like, like);
      }

      if (commandFilter) {
        query += ` AND u.command = ?`;
        countQuery += ` AND u.command = ?`;
        params.push(commandFilter);
        countParams.push(commandFilter);
      }

      query += ` ORDER BY ds.createdAt DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const [rows] = await db.execute(query, params);
      const [[{ total }]] = await db.execute(countQuery, countParams);

      res.json({
        data: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
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
