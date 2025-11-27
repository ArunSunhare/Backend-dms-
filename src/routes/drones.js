// const express = require('express');
// const { getUserDroneSpecs, getAllDroneSpecs } = require('../controllers/droneController');
// const { authenticateToken, requireRole } = require('../middleware/auth');

// const router = express.Router();

// router.get('/user/:userId', authenticateToken, getUserDroneSpecs);
// router.get('/all', authenticateToken, requireRole(['ADMINISTRATOR', 'CONTROLLER']), getAllDroneSpecs);

// module.exports = router;



// // src/routes/drones.js
// const express = require('express');
// const { 
//   getUserDroneSpecs, 
//   getAllDroneSpecs,
//   getDroneSpecsByCommand,
//   getCommandDroneStatistics,
//   updateDroneSpec,
//   deleteDroneSpec
// } = require('../controllers/droneController');
// const { 
//   authenticateToken, 
//   requireRole,
//   requireDataCommandAccess,
//   requireModifyAccess,
//   requireDeleteAccess
// } = require('../middleware/auth');

// const router = express.Router();

// // Get user's drone specs
// router.get('/user/:userId', 
//   authenticateToken, 
//   getUserDroneSpecs
// );

// // Get all drone specs (with role-based filtering)
// router.get('/all', 
//   authenticateToken, 
//   requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']), 
//   requireDataCommandAccess(),
//   getAllDroneSpecs
// );

// // Get drone specs by command
// router.get('/command/:commandCode', 
//   authenticateToken, 
//   requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']),
//   getDroneSpecsByCommand
// );

// // Get drone statistics by command
// router.get('/statistics/commands', 
//   authenticateToken, 
//   requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']),
//   getCommandDroneStatistics
// );

// // Update drone specification
// router.put('/:droneSpecId', 
//   authenticateToken, 
//   requireModifyAccess(),
//   updateDroneSpec
// );

// // Delete drone specification
// router.delete('/:droneSpecId', 
//   authenticateToken, 
//   requireDeleteAccess(),
//   deleteDroneSpec
// );

// module.exports = router;



// src/routes/drones.js → sirf ye route replace kar de

router.get('../controllers/droneController.js', authenticateToken, requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(5000, Math.max(1, parseInt(req.query.limit) || 100));
    const offset = (page - 1) * limit;

    const search = req.query.search ? `%${req.query.search.trim()}%` : null;
    const command = req.query.command || null;
    
    // NEW: Date filter (default today)
    const dateFilter = req.query.date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const startOfDay = `${dateFilter} 00:00:00`;
    const endOfDay = `${dateFilter} 23:59:59`;

    let sql = `
      SELECT 
        ds.*, 
        u.username, u.role, u.command, u.commandName
      FROM drone_specs ds
      JOIN users u ON ds.user_id = u.id
      WHERE ds.createdAt >= ? AND ds.createdAt <= ?
    `;
    const params = [startOfDay, endOfDay];

    if (search) {
      sql += ` AND (ds.droneName LIKE ? OR u.username LIKE ?)`;
      params.push(search, search);
    }
    if (command) {
      sql += ` AND u.command = ?`;
      params.push(command);
    }

    // Count
    const countSql = sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const countParams = params.slice();
    const [[{ total }]] = await pool.execute(countSql, countParams);

    // Main data
    sql += ` ORDER BY ds.createdAt DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.execute(sql, params);

    res.json({
      success: true,
      data: rows,
      date: dateFilter,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    });

  } catch (err) {
    console.error('Drones /all error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});