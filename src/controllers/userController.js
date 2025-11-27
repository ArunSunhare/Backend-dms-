// const { pool } = require('../config/database');

// const getAllUsers = async (req, res) => {
//   try {
//     const [users] = await pool.execute(`
//       SELECT id, username, role, command_number as commandNumber,
//              operatorCategory, operatorCategoryName, command, commandName,
//              division, divisionName, brigade, brigadeName,
//              corps, corpsName, unit, createdAt
//       FROM users 
//       ORDER BY createdAt DESC
//     `);

//     res.json(users);
//   } catch (error) {
//     console.error('Failed to get users:', error);
//     res.status(500).json({ message: 'Failed to retrieve users' });
//   }
// };

// const getUserById = async (req, res) => {
//   try {
//     const { userId } = req.params;

//     const [users] = await pool.execute(`
//       SELECT id, username, role, command_number as commandNumber,
//              operatorCategory, operatorCategoryName, command, commandName,
//              division, divisionName, brigade, brigadeName,
//              corps, corpsName, unit, createdAt
//       FROM users 
//       WHERE id = ?
//     `, [userId]);

//     if (users.length === 0) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     res.json(users[0]);
//   } catch (error) {
//     console.error('Failed to get user:', error);
//     res.status(500).json({ message: 'Failed to retrieve user' });
//   }
// };

// module.exports = { getAllUsers, getUserById };



const { pool, getUsersByCommandAccess } = require('../config/database');

const getAllUsers = async (req, res) => {
  try {
    // Use role-based access to get users
    const users = await getUsersByCommandAccess(req.user.id);
    
    // Add role-based filtering information to response
    const response = {
      users,
      userRole: req.user.role,
      accessibleCommands: req.user.accessibleCommands || [],
      totalCount: users.length
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to get users:', error);
    res.status(500).json({ message: 'Failed to retrieve users' });
  }
};

const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user can access this specific user
    const accessibleUsers = await getUsersByCommandAccess(req.user.id);
    const canAccess = accessibleUsers.some(user => user.id === userId) || req.user.id === userId;

    if (!canAccess) {
      return res.status(403).json({ 
        message: 'Access denied for this user',
        reason: 'User belongs to a command you cannot access'
      });
    }

    const [users] = await pool.execute(`
      SELECT u.*, ch.command_name as hierarchyCommandName,
             ch.command_full_name as hierarchyCommandFullName
      FROM users u
      LEFT JOIN command_hierarchy ch ON u.assigned_command = ch.command_code
      WHERE u.id = ?
    `, [userId]);

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];
    
    // Add role-specific information
    user.roleInfo = {
      canModifyRole: req.user.role === 'SUPER_ADMIN',
      canViewAllData: user.role === 'SUPER_ADMIN' && user.can_access_all_commands,
      managedCommand: user.assigned_command,
      managedCommandName: user.hierarchyCommandName
    };

    res.json(user);
  } catch (error) {
    console.error('Failed to get user:', error);
    res.status(500).json({ message: 'Failed to retrieve user' });
  }
};

const getUsersByCommand = async (req, res) => {
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

    const [users] = await pool.execute(`
      SELECT id, username, role, command_number as commandNumber,
             operatorCategory, operatorCategoryName, command, commandName,
             division, divisionName, brigade, brigadeName,
             corps, corpsName, unit, assigned_command, createdAt
      FROM users 
      WHERE command = ? OR assigned_command = ?
      ORDER BY createdAt DESC
    `, [commandCode, commandCode]);

    res.json({
      users,
      command: commandCode,
      totalCount: users.length
    });
  } catch (error) {
    console.error('Failed to get users by command:', error);
    res.status(500).json({ message: 'Failed to retrieve users by command' });
  }
};

const getCommandStatistics = async (req, res) => {
  try {
    const accessibleUsers = await getUsersByCommandAccess(req.user.id);
    
    // Group users by command for statistics
    const commandStats = {};
    
    accessibleUsers.forEach(user => {
      const command = user.command || user.assigned_command || 'unknown';
      if (!commandStats[command]) {
        commandStats[command] = {
          commandCode: command,
          commandName: user.commandName || 'Unknown Command',
          totalUsers: 0,
          operators: 0,
          controllers: 0,
          admins: 0,
          active: 0
        };
      }
      
      commandStats[command].totalUsers++;
      
      switch (user.role) {
        case 'OPERATOR':
          commandStats[command].operators++;
          break;
        case 'CONTROLLER':
          commandStats[command].controllers++;
          break;
        case 'COMMAND_ADMIN':
          commandStats[command].admins++;
          break;
      }
      
      commandStats[command].active++;
    });

    res.json({
      statistics: Object.values(commandStats),
      userRole: req.user.role,
      accessibleCommands: req.user.accessibleCommands || [],
      totalAccessibleUsers: accessibleUsers.length
    });
  } catch (error) {
    console.error('Failed to get command statistics:', error);
    res.status(500).json({ message: 'Failed to retrieve command statistics' });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    // Check if user can modify this user
    const accessibleUsers = await getUsersByCommandAccess(req.user.id);
    const canModify = accessibleUsers.some(user => user.id === userId);

    if (!canModify) {
      return res.status(403).json({ 
        message: 'Access denied for this user',
        reason: 'User belongs to a command you cannot manage'
      });
    }

    await pool.execute(
      'UPDATE users SET is_active = ?, updatedAt = NOW() WHERE id = ?',
      [isActive, userId]
    );

    res.json({ 
      success: true, 
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully` 
    });
  } catch (error) {
    console.error('Failed to update user status:', error);
    res.status(500).json({ message: 'Failed to update user status' });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const [users] = await pool.execute(`
      SELECT u.*, ch.command_name as hierarchyCommandName,
             ch.command_full_name as hierarchyCommandFullName
      FROM users u
      LEFT JOIN command_hierarchy ch ON u.assigned_command = ch.command_code
      WHERE u.id = ?
    `, [userId]);

    if (users.length === 0) {
      return res.status(404).json({ message: 'User profile not found' });
    }

    const user = users[0];
    
    // Remove password from response
    const { password, ...userProfile } = user;
    
    // Add accessibility information
    userProfile.accessibility = {
      accessibleCommands: req.user.accessibleCommands || [],
      canAccessAllCommands: user.can_access_all_commands || false,
      rolePermissions: {
        canViewAllUsers: ['SUPER_ADMIN', 'COMMAND_ADMIN'].includes(user.role),
        canModifyUsers: ['SUPER_ADMIN', 'COMMAND_ADMIN'].includes(user.role),
        canDeleteData: ['SUPER_ADMIN', 'COMMAND_ADMIN'].includes(user.role),
        canCreateAdmins: user.role === 'SUPER_ADMIN'
      }
    };

    res.json(userProfile);
  } catch (error) {
    console.error('Failed to get user profile:', error);
    res.status(500).json({ message: 'Failed to retrieve user profile' });
  }
};

module.exports = { 
  getAllUsers, 
  getUserById, 
  getUsersByCommand,
  getCommandStatistics,
  updateUserStatus,
  getUserProfile
};