// const { pool } = require('../config/database');
// const { v4: uuidv4 } = require('uuid');

// const getAllFlights = async (req, res) => {
//   try {
//     // First activate due flights
//     await pool.execute(`
//       UPDATE flights 
//       SET status = 'active' 
//       WHERE status = 'planned' AND start <= NOW()
//     `);

//     const [flights] = await pool.execute(`
//       SELECT * FROM flights 
//       ORDER BY start DESC
//     `);

//     console.log("backend : ",flights)
//     res.json(flights);
//   } catch (error) {
//     console.error('Failed to get flights:', error);
//     res.status(500).json({ message: 'Failed to retrieve flights' });
//   }
// };

// const getFlightWaypoints = async (req, res) => {
//   try {
//     const { flightId } = req.params;

//     const [waypoints] = await pool.execute(`
//       SELECT * FROM waypoints 
//       WHERE flight_id = ? 
//       ORDER BY sequence
//     `, [flightId]);

//     res.json(waypoints);
//   } catch (error) {
//     console.error('Failed to get waypoints:', error);
//     res.status(500).json({ message: 'Failed to retrieve waypoints' });
//   }
// };

// const createFlight = async (req, res) => {
//   const connection = await pool.getConnection();
  
//   try {
//     await connection.beginTransaction();
    
//     const { flight, waypoints } = req.body;
//     const flightId = uuidv4();

//     // Insert flight
//     await connection.execute(`
//       INSERT INTO flights (
//         id, user_id, drone_model, drone_class, command_name, frequency,
//         clockDrift, spectralLeakage, modularshapeId, purpose, start, end, status
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `, [
//       flightId, flight.user_id, flight.drone_model, flight.drone_class,
//       flight.command_name, flight.frequency, flight.clockDrift,
//       flight.spectralLeakage, flight.modularshapeId, flight.purpose,
//       flight.start, flight.end, flight.status
//     ]);

//     // Insert waypoints
//     for (let i = 0; i < waypoints.length; i++) {
//       const wp = waypoints[i];
//       await connection.execute(`
//         INSERT INTO waypoints (flight_id, lat, lng, elev, sequence)
//         VALUES (?, ?, ?, ?, ?)
//       `, [flightId, wp.lat, wp.lng, wp.elev, i + 1]);
//     }

//     await connection.commit();
//     res.status(201).json({ success: true, flightId });

//   } catch (error) {
//     await connection.rollback();
//     console.error('Failed to create flight:', error);
//     res.status(500).json({ message: 'Failed to create flight' });
//   } finally {
//     connection.release();
//   }
// };

// const updateFlight = async (req, res) => {
//   try {
//     const { flightId } = req.params;
//     const updates = req.body;

//     const updateFields = [];
//     const updateValues = [];

//     if (updates.drone_model !== undefined) {
//       updateFields.push('drone_model = ?');
//       updateValues.push(updates.drone_model);
//     }
//     if (updates.command_name !== undefined) {
//       updateFields.push('command_name = ?');
//       updateValues.push(updates.command_name);
//     }
//     if (updates.purpose !== undefined) {
//       updateFields.push('purpose = ?');
//       updateValues.push(updates.purpose);
//     }
//     if (updates.start !== undefined) {
//       updateFields.push('start = ?');
//       updateValues.push(updates.start);
//     }
//     if (updates.end !== undefined) {
//       updateFields.push('end = ?');
//       updateValues.push(updates.end);
//     }

//     if (updateFields.length === 0) {
//       return res.status(400).json({ message: 'No valid fields to update' });
//     }

//     updateValues.push(flightId);

//     const sql = `UPDATE flights SET ${updateFields.join(', ')} WHERE id = ?`;
//     await pool.execute(sql, updateValues);

//     res.json({ success: true, message: 'Flight updated successfully' });
//   } catch (error) {
//     console.error('Failed to update flight:', error);
//     res.status(500).json({ message: 'Failed to update flight' });
//   }
// };

// const requestCancelFlight = async (req, res) => {
//   try {
//     const { flightId } = req.params;

//     await pool.execute(
//       'UPDATE flights SET cancel_requested = TRUE WHERE id = ?',
//       [flightId]
//     );

//     res.json({ success: true, message: 'Cancel request submitted' });
//   } catch (error) {
//     console.error('Failed to request cancel:', error);
//     res.status(500).json({ message: 'Failed to request cancellation' });
//   }
// };

// const deleteFlight = async (req, res) => {
//   const connection = await pool.getConnection();
  
//   try {
//     await connection.beginTransaction();
    
//     const { flightId } = req.params;

//     await connection.execute('DELETE FROM waypoints WHERE flight_id = ?', [flightId]);
//     await connection.execute('DELETE FROM flights WHERE id = ?', [flightId]);

//     await connection.commit();
//     res.json({ success: true, message: 'Flight deleted successfully' });

//   } catch (error) {
//     await connection.rollback();
//     console.error('Failed to delete flight:', error);
//     res.status(500).json({ message: 'Failed to delete flight' });
//   } finally {
//     connection.release();
//   }
// };

// module.exports = {
//   getAllFlights,
//   getFlightWaypoints,
//   createFlight,
//   updateFlight,
//   requestCancelFlight,
//   deleteFlight
// };


const { pool, getFlightsByCommandAccess } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const getAllFlights = async (req, res) => {
  try {
    // Use role-based access to get flights
    const flights = await getFlightsByCommandAccess(req.user.id);

    // Group flights by command and status
    const flightsByCommand = {};
    const statusCounts = { planned: 0, active: 0, completed: 0 };

    flights.forEach(flight => {
      const command = flight.command_code || 'unknown';
      if (!flightsByCommand[command]) {
        flightsByCommand[command] = {
          commandCode: command,
          commandName: flight.userCommandName || 'Unknown Command',
          flights: [],
          counts: { planned: 0, active: 0, completed: 0 }
        };
      }
      flightsByCommand[command].flights.push(flight);
      flightsByCommand[command].counts[flight.status]++;
      statusCounts[flight.status]++;
    });

    res.json({
      allFlights: flights,
      flightsByCommand: Object.values(flightsByCommand),
      statusCounts,
      userRole: req.user.role,
      accessibleCommands: req.user.accessibleCommands || [],
      totalFlights: flights.length
    });
  } catch (error) {
    console.error('Failed to get flights:', error);
    res.status(500).json({ message: 'Failed to retrieve flights' });
  }
};

const getFlightsByCommand = async (req, res) => {
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

    // First activate due flights
    await pool.execute(`
      UPDATE flights 
      SET status = 'active' 
      WHERE status = 'planned' AND start <= NOW() AND (command_code = ? OR user_id IN (
        SELECT id FROM users WHERE command = ?
      ))
    `, [commandCode, commandCode]);

    const [flights] = await pool.execute(`
      SELECT f.*, u.username, u.commandName as userCommandName
      FROM flights f
      JOIN users u ON f.user_id = u.id
      WHERE f.command_code = ? OR u.command = ?
      ORDER BY f.start DESC
    `, [commandCode, commandCode]);

    res.json({
      flights,
      command: commandCode,
      totalFlights: flights.length
    });
  } catch (error) {
    console.error('Failed to get flights by command:', error);
    res.status(500).json({ message: 'Failed to retrieve flights by command' });
  }
};

const getFlightWaypoints = async (req, res) => {
  try {
    const { flightId } = req.params;

    // Check if user has access to this flight
    const [flights] = await pool.execute(`
      SELECT f.command_code, u.command, u.assigned_command
      FROM flights f
      JOIN users u ON f.user_id = u.id
      WHERE f.id = ?
    `, [flightId]);

    if (flights.length === 0) {
      return res.status(404).json({ message: 'Flight not found' });
    }

    const flight = flights[0];
    const flightCommand = flight.command_code || flight.command || flight.assigned_command;

    // Check access
    if (!req.user.accessibleCommands.includes(flightCommand) && 
        !(req.user.role === 'SUPER_ADMIN' && req.user.can_access_all_commands)) {
      return res.status(403).json({ 
        message: 'Access denied for this flight',
        reason: 'Flight belongs to a command you cannot access'
      });
    }

    const [waypoints] = await pool.execute(`
      SELECT * FROM waypoints 
      WHERE flight_id = ? 
      ORDER BY sequence
    `, [flightId]);

    res.json(waypoints);
  } catch (error) {
    console.error('Failed to get waypoints:', error);
    res.status(500).json({ message: 'Failed to retrieve waypoints' });
  }
};

const createFlight = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { flight, waypoints } = req.body;
    const flightId = uuidv4();

    // Determine command code for the flight
    const userCommand = req.user.command || req.user.assigned_command;
    
    // Operators can only create flights for their own command
    if (req.user.role === 'OPERATOR' && flight.user_id !== req.user.id) {
      await connection.rollback();
      return res.status(403).json({ 
        message: 'Operators can only create flights for themselves' 
      });
    }

    // Command admins can create flights for users in their command
    if (req.user.role === 'COMMAND_ADMIN') {
      const [targetUser] = await connection.execute(`
        SELECT command, assigned_command FROM users WHERE id = ?
      `, [flight.user_id]);

      if (targetUser.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'Target user not found' });
      }

      const targetUserCommand = targetUser[0].command || targetUser[0].assigned_command;
      if (targetUserCommand !== req.user.assigned_command) {
        await connection.rollback();
        return res.status(403).json({ 
          message: 'Cannot create flight for user from different command' 
        });
      }
    }

    // Insert flight with command association
    await connection.execute(`
      INSERT INTO flights (
        id, user_id, drone_model, drone_class, command_name, command_code, frequency,
        clockDrift, spectralLeakage, modularshapeId, purpose, start, end, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      flightId, flight.user_id, flight.drone_model, flight.drone_class,
      flight.command_name, userCommand, flight.frequency, flight.clockDrift,
      flight.spectralLeakage, flight.modularshapeId, flight.purpose,
      flight.start, flight.end, flight.status
    ]);

    // Insert waypoints
    if (waypoints && Array.isArray(waypoints)) {
      for (let i = 0; i < waypoints.length; i++) {
        const wp = waypoints[i];
        await connection.execute(`
          INSERT INTO waypoints (flight_id, lat, lng, elev, sequence)
          VALUES (?, ?, ?, ?, ?)
        `, [flightId, wp.lat, wp.lng, wp.elev, i + 1]);
      }
    }

    await connection.commit();
    res.status(201).json({ 
      success: true, 
      flightId,
      createdBy: req.user.username,
      command: userCommand
    });

  } catch (error) {
    await connection.rollback();
    console.error('Failed to create flight:', error);
    res.status(500).json({ message: 'Failed to create flight' });
  } finally {
    connection.release();
  }
};

const updateFlight = async (req, res) => {
  try {
    const { flightId } = req.params;
    const updates = req.body;

    // Check if user has access to this flight
    const [flights] = await pool.execute(`
      SELECT f.*, u.command, u.assigned_command
      FROM flights f
      JOIN users u ON f.user_id = u.id
      WHERE f.id = ?
    `, [flightId]);

    if (flights.length === 0) {
      return res.status(404).json({ message: 'Flight not found' });
    }

    const flight = flights[0];
    const flightCommand = flight.command_code || flight.command || flight.assigned_command;

    // Check modification access
    let canModify = false;

    if (req.user.role === 'SUPER_ADMIN' && req.user.can_access_all_commands) {
      canModify = true;
    } else if (req.user.role === 'COMMAND_ADMIN' && req.user.assigned_command === flightCommand) {
      canModify = true;
    } else if (flight.user_id === req.user.id) {
      canModify = true;
    }

    if (!canModify) {
      return res.status(403).json({ 
        message: 'Access denied',
        reason: 'Cannot modify flights for this command'
      });
    }

    const updateFields = [];
    const updateValues = [];

    if (updates.drone_model !== undefined) {
      updateFields.push('drone_model = ?');
      updateValues.push(updates.drone_model);
    }
    if (updates.command_name !== undefined) {
      updateFields.push('command_name = ?');
      updateValues.push(updates.command_name);
    }
    if (updates.purpose !== undefined) {
      updateFields.push('purpose = ?');
      updateValues.push(updates.purpose);
    }
    if (updates.start !== undefined) {
      updateFields.push('start = ?');
      updateValues.push(updates.start);
    }
    if (updates.end !== undefined) {
      updateFields.push('end = ?');
      updateValues.push(updates.end);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(flightId);

    const sql = `UPDATE flights SET ${updateFields.join(', ')} WHERE id = ?`;
    await pool.execute(sql, updateValues);

    res.json({ 
      success: true, 
      message: 'Flight updated successfully',
      updatedBy: req.user.username
    });
  } catch (error) {
    console.error('Failed to update flight:', error);
    res.status(500).json({ message: 'Failed to update flight' });
  }
};

const requestCancelFlight = async (req, res) => {
  try {
    const { flightId } = req.params;

    // Check if user has access to this flight
    const [flights] = await pool.execute(`
      SELECT f.*, u.command, u.assigned_command
      FROM flights f
      JOIN users u ON f.user_id = u.id
      WHERE f.id = ?
    `, [flightId]);

    if (flights.length === 0) {
      return res.status(404).json({ message: 'Flight not found' });
    }

    const flight = flights[0];
    const flightCommand = flight.command_code || flight.command || flight.assigned_command;

    // Check access
    if (!req.user.accessibleCommands.includes(flightCommand) && 
        !(req.user.role === 'SUPER_ADMIN' && req.user.can_access_all_commands) &&
        flight.user_id !== req.user.id) {
      return res.status(403).json({ 
        message: 'Access denied for this flight'
      });
    }

    await pool.execute(
      'UPDATE flights SET cancel_requested = TRUE, updated_at = NOW() WHERE id = ?',
      [flightId]
    );

    res.json({ 
      success: true, 
      message: 'Cancel request submitted',
      requestedBy: req.user.username
    });
  } catch (error) {
    console.error('Failed to request cancel:', error);
    res.status(500).json({ message: 'Failed to request cancellation' });
  }
};

const deleteFlight = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { flightId } = req.params;

    // Check if user has access to delete this flight
    const [flights] = await connection.execute(`
      SELECT f.*, u.command, u.assigned_command
      FROM flights f
      JOIN users u ON f.user_id = u.id
      WHERE f.id = ?
    `, [flightId]);

    if (flights.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Flight not found' });
    }

    const flight = flights[0];
    const flightCommand = flight.command_code || flight.command || flight.assigned_command;

    // Only admins can delete flights
    let canDelete = false;

    if (req.user.role === 'SUPER_ADMIN' && req.user.can_access_all_commands) {
      canDelete = true;
    } else if (req.user.role === 'COMMAND_ADMIN' && req.user.assigned_command === flightCommand) {
      canDelete = true;
    }

    if (!canDelete) {
      await connection.rollback();
      return res.status(403).json({ 
        message: 'Access denied',
        reason: 'Only admins can delete flights'
      });
    }

    await connection.execute('DELETE FROM waypoints WHERE flight_id = ?', [flightId]);
    await connection.execute('DELETE FROM flights WHERE id = ?', [flightId]);

    await connection.commit();
    res.json({ 
      success: true, 
      message: 'Flight deleted successfully',
      deletedBy: req.user.username
    });

  } catch (error) {
    await connection.rollback();
    console.error('Failed to delete flight:', error);
    res.status(500).json({ message: 'Failed to delete flight' });
  } finally {
    connection.release();
  }
};

const approveFlight = async (req, res) => {
  try {
    const { flightId } = req.params;

    // Only admins can approve flights
    if (!['SUPER_ADMIN', 'COMMAND_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Only admins can approve flights' 
      });
    }

    // Check if user has access to this flight
    const [flights] = await pool.execute(`
      SELECT f.*, u.command, u.assigned_command
      FROM flights f
      JOIN users u ON f.user_id = u.id
      WHERE f.id = ?
    `, [flightId]);

    if (flights.length === 0) {
      return res.status(404).json({ message: 'Flight not found' });
    }

    const flight = flights[0];
    const flightCommand = flight.command_code || flight.command || flight.assigned_command;

    // Command admins can only approve flights in their command
    if (req.user.role === 'COMMAND_ADMIN' && req.user.assigned_command !== flightCommand) {
      return res.status(403).json({ 
        message: 'Cannot approve flights from different commands' 
      });
    }

    await pool.execute(
      'UPDATE flights SET status = "active", approved_by = ?, updated_at = NOW() WHERE id = ?',
      [req.user.id, flightId]
    );

    res.json({ 
      success: true, 
      message: 'Flight approved successfully',
      approvedBy: req.user.username
    });
  } catch (error) {
    console.error('Failed to approve flight:', error);
    res.status(500).json({ message: 'Failed to approve flight' });
  }
};

const getFlightStatistics = async (req, res) => {
  try {
    // Use role-based access to get flights
    const flights = await getFlightsByCommandAccess(req.user.id);

    // Calculate comprehensive statistics
    const stats = {
      totalFlights: flights.length,
      statusCounts: { planned: 0, active: 0, completed: 0 },
      commandStats: {},
      recentActivity: [],
      pendingApprovals: 0
    };

    flights.forEach(flight => {
      // Status counts
      stats.statusCounts[flight.status]++;
      
      // Pending approvals
      if (flight.cancel_requested) {
        stats.pendingApprovals++;
      }

      // Command statistics
      const command = flight.command_code || 'unknown';
      if (!stats.commandStats[command]) {
        stats.commandStats[command] = {
          commandCode: command,
          commandName: flight.userCommandName || 'Unknown Command',
          totalFlights: 0,
          activeFlights: 0,
          completedFlights: 0
        };
      }
      
      stats.commandStats[command].totalFlights++;
      if (flight.status === 'active') stats.commandStats[command].activeFlights++;
      if (flight.status === 'completed') stats.commandStats[command].completedFlights++;
    });

    // Recent activity (last 10 flights)
    stats.recentActivity = flights
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10)
      .map(flight => ({
        id: flight.id,
        purpose: flight.purpose,
        status: flight.status,
        commandName: flight.userCommandName,
        createdAt: flight.created_at
      }));

    res.json({
      statistics: stats,
      userRole: req.user.role,
      accessibleCommands: req.user.accessibleCommands || []
    });
  } catch (error) {
    console.error('Failed to get flight statistics:', error);
    res.status(500).json({ message: 'Failed to retrieve flight statistics' });
  }
};

module.exports = {
  getAllFlights,
  getFlightsByCommand,
  getFlightWaypoints,
  createFlight,
  updateFlight,
  requestCancelFlight,
  deleteFlight,
  approveFlight,
  getFlightStatistics
};