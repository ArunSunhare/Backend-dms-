const express = require('express');
const { pool } = require('../config/database');
const { 
  authenticateToken, 
  requireRole,
  requireSuperAdmin
} = require('../middleware/auth');

const router = express.Router();

// Get all commands with hierarchy
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [commands] = await pool.execute(`
      SELECT * FROM command_hierarchy 
      ORDER BY command_name
    `);
    
    res.json({
      commands,
      userRole: req.user.role,
      accessibleCommands: req.user.accessibleCommands || []
    });
  } catch (error) {
    console.error('Failed to get commands:', error);
    res.status(500).json({ message: 'Failed to retrieve commands' });
  }
});

// Get command details with statistics
router.get('/:commandCode', 
  authenticateToken, 
  requireRole(['SUPER_ADMIN', 'COMMAND_ADMIN']),
  async (req, res) => {
    try {
      const { commandCode } = req.params;

      // Check access
      if (!req.user.accessibleCommands.includes(commandCode) && 
          !(req.user.role === 'SUPER_ADMIN' && req.user.can_access_all_commands)) {
        return res.status(403).json({ 
          message: 'Access denied for this command' 
        });
      }

      // Get command details
      const [commands] = await pool.execute(`
        SELECT * FROM command_hierarchy WHERE command_code = ?
      `, [commandCode]);

      if (commands.length === 0) {
        return res.status(404).json({ message: 'Command not found' });
      }

      // Get command statistics
      const [userStats] = await pool.execute(`
        SELECT 
          COUNT(*) as totalUsers,
          SUM(CASE WHEN role = 'OPERATOR' THEN 1 ELSE 0 END) as operators,
          SUM(CASE WHEN role = 'CONTROLLER' THEN 1 ELSE 0 END) as controllers,
          SUM(CASE WHEN role = 'COMMAND_ADMIN' THEN 1 ELSE 0 END) as admins
        FROM users 
        WHERE command = ? OR assigned_command = ?
      `, [commandCode, commandCode]);

      const [flightStats] = await pool.execute(`
        SELECT 
          COUNT(*) as totalFlights,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeFlights,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedFlights
        FROM flights f
        JOIN users u ON f.user_id = u.id
        WHERE f.command_code = ? OR u.command = ?
      `, [commandCode, commandCode]);

      const [droneStats] = await pool.execute(`
        SELECT 
          COUNT(*) as totalSpecs,
          SUM(quantity) as totalDrones
        FROM drone_specs ds
        JOIN users u ON ds.user_id = u.id
        WHERE ds.command_code = ? OR u.command = ?
      `, [commandCode, commandCode]);

      const commandDetails = {
        ...commands[0],
        statistics: {
          users: userStats[0],
          flights: flightStats[0],
          drones: droneStats[0]
        }
      };

      res.json(commandDetails);
    } catch (error) {
      console.error('Failed to get command details:', error);
      res.status(500).json({ message: 'Failed to retrieve command details' });
    }
  }
);

// Update command information (super admin only)
router.put('/:commandCode', 
  authenticateToken, 
  requireSuperAdmin(),
  async (req, res) => {
    try {
      const { commandCode } = req.params;
      const { command_name, command_full_name, headquarters_location, latitude, longitude } = req.body;

      const updateFields = [];
      const updateValues = [];

      if (command_name !== undefined) {
        updateFields.push('command_name = ?');
        updateValues.push(command_name);
      }
      if (command_full_name !== undefined) {
        updateFields.push('command_full_name = ?');
        updateValues.push(command_full_name);
      }
      if (headquarters_location !== undefined) {
        updateFields.push('headquarters_location = ?');
        updateValues.push(headquarters_location);
      }
      if (latitude !== undefined) {
        updateFields.push('latitude = ?');
        updateValues.push(latitude);
      }
      if (longitude !== undefined) {
        updateFields.push('longitude = ?');
        updateValues.push(longitude);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ message: 'No valid fields to update' });
      }

      updateValues.push(commandCode);
      const sql = `UPDATE command_hierarchy SET ${updateFields.join(', ')} WHERE command_code = ?`;
      
      await pool.execute(sql, updateValues);

      res.json({ 
        success: true, 
        message: 'Command updated successfully',
        updatedBy: req.user.username
      });
    } catch (error) {
      console.error('Failed to update command:', error);
      res.status(500).json({ message: 'Failed to update command' });
    }
  }
);

module.exports = router;