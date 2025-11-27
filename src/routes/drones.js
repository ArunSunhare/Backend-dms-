// const express = require('express');
// const { getUserDroneSpecs, getAllDroneSpecs } = require('../controllers/droneController');
// const { authenticateToken, requireRole } = require('../middleware/auth');

// const router = express.Router();

// router.get('/user/:userId', authenticateToken, getUserDroneSpecs);
// router.get('/all', authenticateToken, requireRole(['ADMINISTRATOR', 'CONTROLLER']), getAllDroneSpecs);

// module.exports = router;


// src/routes/drones.js  ← Full Updated & Fixed Version
// src/routes/drones.js  ← FINAL 100% WORKING VERSION
// src/routes/drones.js  ← ULTIMATE FINAL VERSION (100% WORKING)

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

// Tera database.js bilkul perfect hai → pool export karta hai
const { pool } = require('../config/database');

// 1. Get user's own drones
router.get('/user/:userId', authenticateToken, getUserDroneSpecs);

// 2. Get ALL drones — FULLY FIXED (No more errors!)
router.get('/all', authenticateToken, requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']), async (req, res) => {
  try {
    // Pagination (force number conversion)
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(5000, Math.max(1, parseInt(req.query.limit) || 100));
    const offset = (page - 1) * limit;

    // Filters
    const search = req.query.search ? `%${req.query.search.trim()}%` : null;
    const command = req.query.command || null;

    // Base query
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
      sql += ` AND (ds.droneName LIKE ? OR u.username LIKE ?)`;
      params.push(search, search);
    }
    if (command) {
      sql += ` AND u.command = ?`;
      params.push(command);
    }

    // Count total (without LIMIT/OFFSET)
    const countSql = sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const countParams = [...params]; // copy without limit/offset
    const [[{ total }]] = await pool.execute(countSql, countParams);

    // Main query with pagination
    sql += ` ORDER BY ds.createdAt DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset)); // ← YEHI FIX HAI (Number() lagaya)

    const [rows] = await pool.execute(sql, params);

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
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: err.message 
    });
  }
});

// 3. By command
router.get('/command/:commandCode', authenticateToken, requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']), async (req, res) => {
  const { commandCode } = req.params;
  const [rows] = await pool.execute(`
    SELECT ds.*, u.username 
    FROM drone_specs ds
    JOIN users u ON ds.user_id = u.id
    WHERE u.command = ? 
    ORDER BY ds.createdAt DESC 
    LIMIT 1000
  `, [commandCode]);
  res.json({ success: true, data: rows });
});

// 4. Statistics
router.get('/statistics/commands', authenticateToken, requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']), async (req, res) => {
  const [rows] = await pool.execute(`
    SELECT u.command, u.commandName, COUNT(ds.id) as droneCount
    FROM users u
    LEFT JOIN drone_specs ds ON u.id = ds.user_id
    WHERE u.role = 'OPERATOR'
    GROUP BY u.command, u.commandName
    ORDER BY droneCount DESC
  `);
  res.json({ success: true, data: rows });
});

// 5. Update & Delete
router.put('/:droneSpecId', authenticateToken, requireModifyAccess(), updateDroneSpec);
router.delete('/:droneSpecId', authenticateToken, requireDeleteAccess(), deleteDroneSpec);

module.exports = router;