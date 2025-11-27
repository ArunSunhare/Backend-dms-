// const express = require('express');
// const { getUserDroneSpecs, getAllDroneSpecs } = require('../controllers/droneController');
// const { authenticateToken, requireRole } = require('../middleware/auth');

// const router = express.Router();

// router.get('/user/:userId', authenticateToken, getUserDroneSpecs);
// router.get('/all', authenticateToken, requireRole(['ADMINISTRATOR', 'CONTROLLER']), getAllDroneSpecs);

// module.exports = router;


// src/routes/drones.js  ← Full Updated & Fixed Version

const express = require('express');
const { 
  getUserDroneSpecs,
  updateDroneSpec,
  deleteDroneSpec
} = require('../controllers/droneController');

const { 
  authenticateToken, 
  requireRole,
  requireModifyAccess,
  requireDeleteAccess
} = require('../middleware/auth');

const router = express.Router();
const db = require('../config/database'); // ← make sure this is your mysql2/promise pool

// 1. Get user's own drones (fast)
router.get('/user/:userId', authenticateToken, getUserDroneSpecs);

// 2. NEW: Get ALL drones with pagination, search, filter (SUPER FAST)
router.get('/all', authenticateToken, requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(5000, Math.max(1, parseInt(req.query.limit) || 100));
    const offset = (page - 1) * limit;

    const search = req.query.search ? `%${req.query.search.trim()}%` : null;
    const command = req.query.command || null;

    let sql = `
      SELECT 
        ds.*, 
        u.username, u.role, u.command, u.commandName
      FROM drone_specs ds
      JOIN users u ON ds.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (ds.droneName LIKE ? OR u.username LIKE ? OR ds.drone_id LIKE ?)`;
      params.push(search, search, search);
    }
    if (command) {
      sql += ` AND u.command = ?`;
      params.push(command);
    }

    // Count total
    const countSql = sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const [[{ total }]] = await db.execute(countSql, params);

    // Main data with pagination
    sql += ` ORDER BY ds.createdAt DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await db.execute(sql, params);

    res.json({
      success: true,
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
    console.error('Drones /all error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// 3. Get drones by specific command (optional)
router.get('/command/:commandCode', authenticateToken, requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']), async (req, res) => {
  const { commandCode } = req.params;
  const [rows] = await db.execute(`
    SELECT ds.*, u.username FROM drone_specs ds
    JOIN users u ON ds.user_id = u.id
    WHERE u.command = ? LIMIT 1000
  `, [commandCode]);
  res.json({ success: true, data: rows });
});

// 4. Statistics (fast)
router.get('/statistics/commands', authenticateToken, requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']), async (req, res) => {
  const [rows] = await db.execute(`
    SELECT u.command, u.commandName, COUNT(ds.id) as droneCount
    FROM users u
    LEFT JOIN drone_specs ds ON u.id = ds.user_id
    WHERE u.role = 'OPERATOR'
    GROUP BY u.command, u.commandName
    ORDER BY droneCount DESC
  `);
  res.json({ success: true, data: rows });
});

// 5. Update & Delete (unchanged)
router.put('/:droneSpecId', authenticateToken, requireModifyAccess(), updateDroneSpec);
router.delete('/:droneSpecId', authenticateToken, requireDeleteAccess(), deleteDroneSpec);

module.exports = router;