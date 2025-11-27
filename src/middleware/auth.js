// const jwt = require('jsonwebtoken');
// const { pool } = require('../config/database');

// const authenticateToken = async (req, res, next) => {
//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1];

//   if (!token) {
//     return res.status(401).json({ message: 'Access token required' });
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET); 
    
//     // FIXED: Use correct column name 'command_number' (snake_case as in your insert/max query)
//     const [users] = await pool.execute(
//       'SELECT id, username, role, command_number, operatorCategory, operatorCategoryName, command, commandName, division, divisionName, brigade, brigadeName, corps, corpsName, unit FROM users WHERE id = ?',
//       [decoded.userId]
//     );

//     if (users.length === 0) {
//       return res.status(401).json({ message: 'User not found' });
//     }

//     req.user = users[0];
//     next();
//   } catch (error) {
//     // OPTIONAL IMPROVEMENT: Log the error for debugging (don't expose to client)
//     console.error('Authentication error:', error.message);
//     return res.status(403).json({ message: 'Invalid token' });
//   }
// };

// const requireRole = (roles) => {
//   return (req, res, next) => {
//     if (!req.user || !roles.includes(req.user.role)) {
//       return res.status(403).json({ message: 'Insufficient permissions' });
//     }
//     next();
//   };
// };

// module.exports = { authenticateToken, requireRole };



const jwt = require('jsonwebtoken');
const { pool, getUserCommandAccess } = require('../config/database');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database to ensure they still exist and get current role info
    const [users] = await pool.execute(
      `SELECT id, username, role, command_number as commandNumber, 
              operatorCategory, operatorCategoryName, command, commandName,
              division, divisionName, brigade, brigadeName,
              corps, corpsName, unit, assigned_command, can_access_all_commands,
              is_active
       FROM users 
       WHERE id = ? AND is_active = true`,
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    const user = users[0];
    
    // Add command access information to user object
    user.accessibleCommands = await getUserCommandAccess(user.id);
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// Role-based access control middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
};

// Command-based access control middleware
const requireCommandAccess = (commandCode) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Super admin with all access can access any command
    if (req.user.role === 'SUPER_ADMIN' && req.user.can_access_all_commands) {
      return next();
    }

    // Check if user has access to the specific command
    if (!req.user.accessibleCommands || !req.user.accessibleCommands.includes(commandCode)) {
      return res.status(403).json({ 
        message: 'Access denied for this command',
        userCommands: req.user.accessibleCommands || []
      });
    }

    next();
  };
};

// Middleware to check if user can access data from a specific command
const requireDataCommandAccess = () => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Super admin with all access can access any data
    if (req.user.role === 'SUPER_ADMIN' && req.user.can_access_all_commands) {
      req.canAccessAllData = true;
      return next();
    }

    // Set accessible commands for filtering data
    req.canAccessAllData = false;
    req.accessibleCommands = req.user.accessibleCommands || [];
    
    next();
  };
};

// Middleware to check if user can modify data (create/update/delete)
const requireModifyAccess = () => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Super admin and command admin can modify data
    if (['SUPER_ADMIN', 'COMMAND_ADMIN'].includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({ message: 'Insufficient permissions for modification' });
  };
};

// Middleware to check if user can delete data (only admins)
const requireDeleteAccess = () => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Only super admin and command admin can delete data
    if (['SUPER_ADMIN', 'COMMAND_ADMIN'].includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({ message: 'Insufficient permissions for deletion' });
  };
};

// Middleware to check super admin access
const requireSuperAdmin = () => {
  return (req, res, next) => {
    if (!req.user || req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Super admin access required' });
    }
    next();
  };
};

// Middleware to validate command access for specific operations
const validateCommandOperation = () => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { commandCode } = req.body;
    
    // If operation involves a specific command, validate access
    if (commandCode) {
      // Super admin with all access can operate on any command
      if (req.user.role === 'SUPER_ADMIN' && req.user.can_access_all_commands) {
        return next();
      }

      // Check if user has access to this command
      if (!req.user.accessibleCommands || !req.user.accessibleCommands.includes(commandCode)) {
        return res.status(403).json({ 
          message: `Access denied for command: ${commandCode}`,
          allowedCommands: req.user.accessibleCommands || []
        });
      }
    }

    next();
  };
};

module.exports = { 
  authenticateToken, 
  requireRole,
  requireCommandAccess,
  requireDataCommandAccess,
  requireModifyAccess,
  requireDeleteAccess,
  requireSuperAdmin,
  validateCommandOperation
};