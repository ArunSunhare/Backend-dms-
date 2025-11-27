// const { pool } = require('../config/database');

// const getUserDroneSpecs = async (req, res) => {
//   try {
//     const { userId } = req.params;

//     const [specs] = await pool.execute(`
//       SELECT * FROM drone_specs 
//       WHERE user_id = ? 
//       ORDER BY createdAt DESC
//     `, [userId]);

//     // Get drone IDs for each spec
//     for (let spec of specs) {
//       const [droneIds] = await pool.execute(`
//         SELECT drone_id FROM drone_ids 
//         WHERE drone_spec_id = ?
//       `, [spec.id]);
      
//       spec.droneIds = droneIds.map(row => row.drone_id);
//     }

//     res.json(specs);
//   } catch (error) {
//     console.error('Failed to get drone specs:', error);
//     res.status(500).json({ message: 'Failed to retrieve drone specifications' });
//   }
// };

// const getAllDroneSpecs = async (req, res) => {
//   try {
//     const [specs] = await pool.execute(`
//       SELECT 
//         ds.*,
//         u.username,
//         u.unit as userUnit,
//         u.role as userRole,
//         u.commandName as userCommandName,
//         u.divisionName as userDivisionName,
//         u.brigadeName as userBrigadeName,
//         u.corpsName as userCorpsName,
//         u.createdAt as userCreatedAt
//       FROM drone_specs ds
//       JOIN users u ON ds.user_id = u.id
//       ORDER BY ds.createdAt DESC
//     `);

//     // Get drone IDs for each spec
//     for (let spec of specs) {
//       const [droneIds] = await pool.execute(`
//         SELECT drone_id FROM drone_ids 
//         WHERE drone_spec_id = ?
//       `, [spec.id]);
      
//       spec.droneIds = droneIds.map(row => row.drone_id);
//     }

//     res.json(specs);
//   } catch (error) {
//     console.error('Failed to get all drone specs:', error);
//     res.status(500).json({ message: 'Failed to retrieve drone specifications' });
//   }
// };

// module.exports = { getUserDroneSpecs, getAllDroneSpecs };



const { pool, getDroneSpecsByCommandAccess } = require('../config/database');

const getUserDroneSpecs = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if requesting user can access this user's data
    if (req.user.id !== userId && !['SUPER_ADMIN', 'COMMAND_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Access denied',
        reason: 'Can only access your own drone specifications'
      });
    }

    // For command admins, check if the target user is in their command
    if (req.user.role === 'COMMAND_ADMIN' && req.user.id !== userId) {
      const [targetUser] = await pool.execute(`
        SELECT command, assigned_command FROM users WHERE id = ?
      `, [userId]);

      if (targetUser.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const targetUserCommand = targetUser[0].command || targetUser[0].assigned_command;
      if (targetUserCommand !== req.user.assigned_command) {
        return res.status(403).json({ 
          message: 'Access denied',
          reason: 'User belongs to a different command'
        });
      }
    }

    const [specs] = await pool.execute(`
      SELECT ds.*, u.username, u.commandName, u.unit as userUnit
      FROM drone_specs ds
      JOIN users u ON ds.user_id = u.id
      WHERE ds.user_id = ? 
      ORDER BY ds.createdAt DESC
    `, [userId]);

    // Get drone IDs for each spec
    for (let spec of specs) {
      const [droneIds] = await pool.execute(`
        SELECT drone_id FROM drone_ids 
        WHERE drone_spec_id = ?
      `, [spec.id]);
      
      spec.droneIds = droneIds.map(row => row.drone_id);
    }

    res.json({
      specs,
      userId,
      canModify: req.user.id === userId || ['SUPER_ADMIN', 'COMMAND_ADMIN'].includes(req.user.role)
    });
  } catch (error) {
    console.error('Failed to get drone specs:', error);
    res.status(500).json({ message: 'Failed to retrieve drone specifications' });
  }
};

const getAllDroneSpecs = async (req, res) => {
  try {
    // Use role-based access to get drone specs
    const specs = await getDroneSpecsByCommandAccess(req.user.id);

    // Group specs by command for better organization
    const specsByCommand = {};
    
    specs.forEach(spec => {
      const command = spec.command_code || 'unknown';
      if (!specsByCommand[command]) {
        specsByCommand[command] = {
          commandCode: command,
          commandName: spec.commandName || 'Unknown Command',
          specs: [],
          totalDrones: 0
        };
      }
      specsByCommand[command].specs.push(spec);
      specsByCommand[command].totalDrones += spec.quantity || 1;
    });

    res.json({
      allSpecs: specs,
      specsByCommand: Object.values(specsByCommand),
      userRole: req.user.role,
      accessibleCommands: req.user.accessibleCommands || [],
      totalSpecs: specs.length,
      totalDrones: specs.reduce((sum, spec) => sum + (spec.quantity || 1), 0)
    });
  } catch (error) {
    console.error('Failed to get all drone specs:', error);
    res.status(500).json({ message: 'Failed to retrieve drone specifications' });
  }
};

const getDroneSpecsByCommand = async (req, res) => {
  try {
    const { commandCode } = req.params;

    // Check if user has access to this command
    if (!req.user.accessibleCommands.includes(commandCode) && 
        !(req.user.role === 'SUPER_ADMIN' && req.user.can_access_all_commands)) {
      return res.status(403).json({ 
        message: 'Access denied for this command',
        allowedCommands: req.user.accessibleCommands || []
      });
    }

    const [specs] = await pool.execute(`
      SELECT ds.*, u.username, u.unit as userUnit, u.commandName
      FROM drone_specs ds
      JOIN users u ON ds.user_id = u.id
      WHERE ds.command_code = ? OR u.command = ?
      ORDER BY ds.createdAt DESC
    `, [commandCode, commandCode]);

    // Get drone IDs for each spec
    for (let spec of specs) {
      const [droneIds] = await pool.execute(`
        SELECT drone_id FROM drone_ids 
        WHERE drone_spec_id = ?
      `, [spec.id]);
      
      spec.droneIds = droneIds.map(row => row.drone_id);
    }

    res.json({
      specs,
      command: commandCode,
      totalSpecs: specs.length,
      totalDrones: specs.reduce((sum, spec) => sum + (spec.quantity || 1), 0)
    });
  } catch (error) {
    console.error('Failed to get drone specs by command:', error);
    res.status(500).json({ message: 'Failed to retrieve drone specifications by command' });
  }
};

const getCommandDroneStatistics = async (req, res) => {
  try {
    // Use role-based access to get drone specs
    const specs = await getDroneSpecsByCommandAccess(req.user.id);

    // Calculate statistics by command
    const commandStats = {};
    
    specs.forEach(spec => {
      const command = spec.command_code || 'unknown';
      if (!commandStats[command]) {
        commandStats[command] = {
          commandCode: command,
          commandName: spec.commandName || 'Unknown Command',
          totalSpecs: 0,
          totalDrones: 0,
          droneTypes: new Set(),
          users: new Set()
        };
      }
      
      commandStats[command].totalSpecs++;
      commandStats[command].totalDrones += spec.quantity || 1;
      commandStats[command].droneTypes.add(spec.droneName);
      commandStats[command].users.add(spec.username);
    });

    // Convert sets to arrays and counts
    Object.values(commandStats).forEach(stat => {
      stat.uniqueDroneTypes = stat.droneTypes.size;
      stat.uniqueUsers = stat.users.size;
      stat.droneTypesList = Array.from(stat.droneTypes);
      stat.usersList = Array.from(stat.users);
      delete stat.droneTypes;
      delete stat.users;
    });

    res.json({
      statistics: Object.values(commandStats),
      userRole: req.user.role,
      accessibleCommands: req.user.accessibleCommands || [],
      totalCommandsWithDrones: Object.keys(commandStats).length
    });
  } catch (error) {
    console.error('Failed to get drone statistics:', error);
    res.status(500).json({ message: 'Failed to retrieve drone statistics' });
  }
};

const updateDroneSpec = async (req, res) => {
  try {
    const { droneSpecId } = req.params;
    const updates = req.body;

    // Get the drone spec to check ownership and access
    const [specs] = await pool.execute(`
      SELECT ds.*, u.command, u.assigned_command
      FROM drone_specs ds
      JOIN users u ON ds.user_id = u.id
      WHERE ds.id = ?
    `, [droneSpecId]);

    if (specs.length === 0) {
      return res.status(404).json({ message: 'Drone specification not found' });
    }

    const spec = specs[0];
    const specCommand = spec.command_code || spec.command || spec.assigned_command;

    // Check if user has access to modify this spec
    let canModify = false;

    if (req.user.role === 'SUPER_ADMIN' && req.user.can_access_all_commands) {
      canModify = true;
    } else if (req.user.role === 'COMMAND_ADMIN' && req.user.assigned_command === specCommand) {
      canModify = true;
    } else if (spec.user_id === req.user.id) {
      canModify = true;
    }

    if (!canModify) {
      return res.status(403).json({ 
        message: 'Access denied',
        reason: 'Cannot modify drone specifications for this command'
      });
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    if (updates.quantity !== undefined) {
      updateFields.push('quantity = ?');
      updateValues.push(updates.quantity);
    }
    if (updates.frequency !== undefined) {
      updateFields.push('frequency = ?');
      updateValues.push(updates.frequency);
    }
    if (updates.maxHeight !== undefined) {
      updateFields.push('maxHeight = ?');
      updateValues.push(updates.maxHeight);
    }
    if (updates.maxSpeed !== undefined) {
      updateFields.push('maxSpeed = ?');
      updateValues.push(updates.maxSpeed);
    }
    if (updates.maxRange !== undefined) {
      updateFields.push('maxRange = ?');
      updateValues.push(updates.maxRange);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    updateValues.push(droneSpecId);

    const sql = `UPDATE drone_specs SET ${updateFields.join(', ')} WHERE id = ?`;
    await pool.execute(sql, updateValues);

    res.json({ 
      success: true, 
      message: 'Drone specification updated successfully',
      updatedBy: req.user.username
    });
  } catch (error) {
    console.error('Failed to update drone spec:', error);
    res.status(500).json({ message: 'Failed to update drone specification' });
  }
};

const deleteDroneSpec = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { droneSpecId } = req.params;

    await connection.beginTransaction();

    // Get the drone spec to check ownership and access
    const [specs] = await connection.execute(`
      SELECT ds.*, u.command, u.assigned_command
      FROM drone_specs ds
      JOIN users u ON ds.user_id = u.id
      WHERE ds.id = ?
    `, [droneSpecId]);

    if (specs.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Drone specification not found' });
    }

    const spec = specs[0];
    const specCommand = spec.command_code || spec.command || spec.assigned_command;

    // Check if user has access to delete this spec
    let canDelete = false;

    if (req.user.role === 'SUPER_ADMIN' && req.user.can_access_all_commands) {
      canDelete = true;
    } else if (req.user.role === 'COMMAND_ADMIN' && req.user.assigned_command === specCommand) {
      canDelete = true;
    }

    if (!canDelete) {
      await connection.rollback();
      return res.status(403).json({ 
        message: 'Access denied',
        reason: 'Cannot delete drone specifications for this command'
      });
    }

    // Delete drone IDs first
    await connection.execute('DELETE FROM drone_ids WHERE drone_spec_id = ?', [droneSpecId]);
    
    // Delete drone spec
    await connection.execute('DELETE FROM drone_specs WHERE id = ?', [droneSpecId]);

    await connection.commit();
    
    res.json({ 
      success: true, 
      message: 'Drone specification deleted successfully',
      deletedBy: req.user.username
    });

  } catch (error) {
    await connection.rollback();
    console.error('Failed to delete drone spec:', error);
    res.status(500).json({ message: 'Failed to delete drone specification' });
  } finally {
    connection.release();
  }
};

module.exports = { 
  getUserDroneSpecs, 
  getAllDroneSpecs,
  getDroneSpecsByCommand,
  getCommandDroneStatistics,
  updateDroneSpec,
  deleteDroneSpec
};