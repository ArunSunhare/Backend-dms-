// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// const { v4: uuidv4 } = require('uuid');
// const { pool } = require('../config/database');

// const register = async (req, res) => {
//   const connection = await pool.getConnection();
  
//   try {
//     await connection.beginTransaction();
    
//     const { 
//       username,  
//       password, 
//       operatorCategory,
//       command,
//       division,
//       brigade,
//       corps,
//       unit,
//       droneSpecs 
//     } = req.body;

//     // Check if username exists
//     const [existingUsers] = await connection.execute(
//       'SELECT username FROM users WHERE username = ?',
//       [username]
//     );

//     if (existingUsers.length > 0) {
//       await connection.rollback();
//       return res.status(400).json({ success: false, message: 'Username already exists' });
//     }

//     // Hash password
//     const hashedPassword = await bcrypt.hash(password, 10);
    
//     // Generate user ID
//     const userId = uuidv4();
    
//     // Get next command number
//     const [maxCommand] = await connection.execute(
//       'SELECT MAX(command_number) as maxNum FROM users'
//     );
//     const nextCommandNumber = (maxCommand[0].maxNum || 0) + 1;

//     // Insert user with all registration data
//     await connection.execute(
//       `INSERT INTO users (
//         id, username, password, role, command_number, 
//         operatorCategory, operatorCategoryName, command, commandName,
//         division, divisionName, brigade, brigadeName, 
//         corps, corpsName, unit, createdAt
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
//       [
//         userId, username, hashedPassword, 'OPERATOR', nextCommandNumber,
//         operatorCategory.key, operatorCategory.name,
//         command.key, command.name,
//         division.key, division.name,
//         brigade.key, brigade.name,
//         corps.key, corps.name,
//         unit
//       ]
//     );

//     // Insert drone specifications
//     for (const droneSpec of droneSpecs) {
//       const droneSpecId = uuidv4();
      
//       await connection.execute(
//         `INSERT INTO drone_specs (
//           id, user_id, droneName, quantity, frequency, clockDrift, spectralLeakage,
//           modularshapeId, maxHeight, maxSpeed, maxRange, maxDuration,
//           gpsEnabled, autonomous, controlled, cameraEnabled, cameraResolution,
//           operatingFrequency, createdAt
//         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
//         [
//           droneSpecId, userId, droneSpec.droneName, droneSpec.quantity,
//           droneSpec.frequency, droneSpec.clockDrift, droneSpec.spectralLeakage,
//           droneSpec.modularshapeId, droneSpec.maxHeight, droneSpec.maxSpeed,
//           droneSpec.maxRange, droneSpec.maxDuration, droneSpec.gpsEnabled,
//           droneSpec.autonomous, droneSpec.controlled, droneSpec.cameraEnabled,
//           droneSpec.cameraResolution || '', droneSpec.operatingFrequency || ''
//         ]
//       );

//       // Insert drone IDs
//       for (const droneId of droneSpec.droneIds) {
//         if (droneId.trim()) {
//           const droneIdRecordId = uuidv4();
//           await connection.execute(
//             'INSERT INTO drone_ids (id, drone_spec_id, drone_id) VALUES (?, ?, ?)',
//             [droneIdRecordId, droneSpecId, droneId.trim()]
//           );
//         }
//       }
//     }

//     await connection.commit();
//     res.status(201).json({ success: true, message: 'Registration successful', userId });

//   } catch (error) {
//     await connection.rollback();
//     console.error('Registration failed:', error);
//     res.status(500).json({ success: false, message: 'Registration failed due to an error' });
//   } finally {
//     connection.release();
//   }
// };

// const login = async (req, res) => {
//   try {
//     const { username, password } = req.body;

//     const [users] = await pool.execute(
//       'SELECT * FROM users WHERE username = ?',
//       [username]
//     );

//     if (users.length === 0) {
//       return res.status(401).json({ success: false, message: 'Invalid credentials' });
//     }

//     const user = users[0];
//     const isValidPassword = await bcrypt.compare(password, user.password);

//     if (!isValidPassword) {
//       return res.status(401).json({ success: false, message: 'Invalid credentials' });
//     }

//     // Generate JWT token
//     const token = jwt.sign(
//       { userId: user.id, username: user.username, role: user.role },
//       process.env.JWT_SECRET,
//       { expiresIn: '24h' }
//     );

//     // Remove password from response
//     const { password: _, ...userWithoutPassword } = user;

//     res.json({
//       success: true,
//       token,
//       user: userWithoutPassword
//     });

//   } catch (error) {
//     console.error('Login failed:', error);
//     res.status(500).json({ success: false, message: 'Login failed' });
//   }
// };

// module.exports = { register, login };



const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

const register = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { 
      username, 
      password, 
      role = 'OPERATOR', // Default role
      operatorCategory,
      command,
      division,
      brigade,
      corps,
      unit,
      droneSpecs,
      assignedCommand, // For COMMAND_ADMIN role
      canAccessAllCommands = false // For SUPER_ADMIN role
    } = req.body;

    // Validate role-specific requirements
    if (role === 'COMMAND_ADMIN' && !assignedCommand) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Command admin must have an assigned command' 
      });
    }

    // Check if username exists
    const [existingUsers] = await connection.execute(
      'SELECT username FROM users WHERE username = ?',
      [username]
    );

    if (existingUsers.length > 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate user ID
    const userId = uuidv4();
    
    // Get next command number
    const [maxCommand] = await connection.execute(
      'SELECT MAX(command_number) as maxNum FROM users'
    );
    const nextCommandNumber = (maxCommand[0].maxNum || 0) + 1;

    // Determine command assignment based on role
    let userAssignedCommand = null;
    let userCanAccessAll = false;

    if (role === 'SUPER_ADMIN') {
      userCanAccessAll = canAccessAllCommands;
    } else if (role === 'COMMAND_ADMIN') {
      userAssignedCommand = assignedCommand;
    }

    // Insert user with role-based access fields
    await connection.execute(
      `INSERT INTO users (
        id, username, password, role, command_number, 
        operatorCategory, operatorCategoryName, command, commandName,
        division, divisionName, brigade, brigadeName, 
        corps, corpsName, unit, assigned_command, can_access_all_commands,
        createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId, username, hashedPassword, role, nextCommandNumber,
        operatorCategory?.key || '', operatorCategory?.name || '',
        command?.key || '', command?.name || '',
        division?.key || '', division?.name || '',
        brigade?.key || '', brigade?.name || '',
        corps?.key || '', corps?.name || '',
        unit || '', userAssignedCommand, userCanAccessAll
      ]
    );

    // Insert drone specifications with command association
    if (droneSpecs && Array.isArray(droneSpecs)) {
      for (const droneSpec of droneSpecs) {
        const droneSpecId = uuidv4();
        
        await connection.execute(
          `INSERT INTO drone_specs (
            id, user_id, droneName, quantity, frequency, clockDrift, spectralLeakage,
            modularshapeId, maxHeight, maxSpeed, maxRange, maxDuration,
            gpsEnabled, autonomous, controlled, cameraEnabled, cameraResolution,
            operatingFrequency, command_code, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            droneSpecId, userId, droneSpec.droneName, droneSpec.quantity,
            droneSpec.frequency, droneSpec.clockDrift || 0, droneSpec.spectralLeakage || 0,
            droneSpec.modularshapeId || 0, droneSpec.maxHeight, droneSpec.maxSpeed,
            droneSpec.maxRange, droneSpec.maxDuration, droneSpec.gpsEnabled,
            droneSpec.autonomous, droneSpec.controlled, droneSpec.cameraEnabled,
            droneSpec.cameraResolution || '', droneSpec.operatingFrequency || '',
            command?.key || userAssignedCommand // Associate with command
          ]
        );

        // Insert drone IDs
        if (droneSpec.droneIds && Array.isArray(droneSpec.droneIds)) {
          for (const droneId of droneSpec.droneIds) {
            if (droneId.trim()) {
              const droneIdRecordId = uuidv4();
              await connection.execute(
                'INSERT INTO drone_ids (id, drone_spec_id, drone_id) VALUES (?, ?, ?)',
                [droneIdRecordId, droneSpecId, droneId.trim()]
              );
            }
          }
        }
      }
    }

    await connection.commit();
    res.status(201).json({ 
      success: true, 
      message: 'Registration successful', 
      userId,
      role: role 
    });

  } catch (error) {
    await connection.rollback();
    console.error('Registration failed:', error);
    res.status(500).json({ success: false, message: 'Registration failed due to an error' });
  } finally {
    connection.release();
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const [users] = await pool.execute(
      `SELECT u.*, ch.command_name as hierarchyCommandName 
       FROM users u
       LEFT JOIN command_hierarchy ch ON u.assigned_command = ch.command_code
       WHERE u.username = ? AND u.is_active = true`,
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = users[0];
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Generate JWT token with role information
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role,
        assignedCommand: user.assigned_command,
        canAccessAllCommands: user.can_access_all_commands
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    // Add role-specific information to response
    const responseUser = {
      ...userWithoutPassword,
      rolePermissions: {
        canAccessAllCommands: user.can_access_all_commands,
        assignedCommand: user.assigned_command,
        assignedCommandName: user.hierarchyCommandName
      }
    };

    res.json({
      success: true,
      token,
      user: responseUser
    });

  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

// Create command admin (only for super admin)
const createCommandAdmin = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    // Check if requester is super admin
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only super admin can create command admins' 
      });
    }

    await connection.beginTransaction();
    
    const { 
      username, 
      password, 
      assignedCommand,
      commandName
    } = req.body;

    // Validate required fields
    if (!username || !password || !assignedCommand) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Username, password, and assigned command are required' 
      });
    }

    // Check if command exists
    const [commands] = await connection.execute(
      'SELECT * FROM command_hierarchy WHERE command_code = ?',
      [assignedCommand]
    );

    if (commands.length === 0) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid command code' 
      });
    }

    // Check if username exists
    const [existingUsers] = await connection.execute(
      'SELECT username FROM users WHERE username = ?',
      [username]
    );

    if (existingUsers.length > 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate user ID
    const userId = uuidv4();
    
    // Get next command number
    const [maxCommand] = await connection.execute(
      'SELECT MAX(command_number) as maxNum FROM users'
    );
    const nextCommandNumber = (maxCommand[0].maxNum || 0) + 1;

    // Insert command admin user
    await connection.execute(
      `INSERT INTO users (
        id, username, password, role, command_number, 
        operatorCategory, operatorCategoryName, command, commandName,
        division, divisionName, brigade, brigadeName, 
        corps, corpsName, unit, assigned_command, can_access_all_commands,
        createdAt
      ) VALUES (?, ?, ?, 'COMMAND_ADMIN', ?, 'a', 'Army', ?, ?, '', '', '', '', '', '', 
               ?, ?, false, NOW())`,
      [
        userId, username, hashedPassword, nextCommandNumber,
        assignedCommand, commandName || commands[0].command_name,
        `${commandName || commands[0].command_name} HQ`, assignedCommand
      ]
    );

    await connection.commit();
    res.status(201).json({ 
      success: true, 
      message: 'Command admin created successfully', 
      userId,
      assignedCommand: assignedCommand
    });

  } catch (error) {
    await connection.rollback();
    console.error('Failed to create command admin:', error);
    res.status(500).json({ success: false, message: 'Failed to create command admin' });
  } finally {
    connection.release();
  }
};

// Get all available commands
const getCommands = async (req, res) => {
  try {
    const [commands] = await pool.execute(
      'SELECT * FROM command_hierarchy ORDER BY command_name'
    );

    res.json({
      success: true,
      commands
    });
  } catch (error) {
    console.error('Failed to get commands:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve commands' });
  }
};

// Update user role (only for super admin)
const updateUserRole = async (req, res) => {
  try {
    // Check if requester is super admin
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only super admin can update user roles' 
      });
    }

    const { userId } = req.params;
    const { role, assignedCommand, canAccessAllCommands } = req.body;

    // Validate role
    const validRoles = ['SUPER_ADMIN', 'COMMAND_ADMIN', 'CONTROLLER', 'OPERATOR'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid role specified' 
      });
    }

    const updateFields = ['role = ?'];
    const updateValues = [role];

    if (role === 'COMMAND_ADMIN' && assignedCommand) {
      updateFields.push('assigned_command = ?');
      updateValues.push(assignedCommand);
    }

    if (role === 'SUPER_ADMIN') {
      updateFields.push('can_access_all_commands = ?');
      updateValues.push(canAccessAllCommands || false);
    }

    updateFields.push('updatedAt = NOW()');
    updateValues.push(userId);

    const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    await pool.execute(sql, updateValues);

    res.json({ success: true, message: 'User role updated successfully' });
  } catch (error) {
    console.error('Failed to update user role:', error);
    res.status(500).json({ success: false, message: 'Failed to update user role' });
  }
};

module.exports = { 
  register, 
  login, 
  createCommandAdmin, 
  getCommands, 
  updateUserRole 
};