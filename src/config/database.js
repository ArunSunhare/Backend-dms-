// const mysql = require('mysql2/promise');
// require('dotenv').config();

// const dbConfig = {
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0
// };

// // Create connection pool
// const pool = mysql.createPool(dbConfig);

// // Initialize database and tables
// async function initializeDatabase() {
//   try {
//     // Create database if it doesn't exist
//     const connection = await mysql.createConnection({
//       host: process.env.DB_HOST,
//       user: process.env.DB_USER,
//       password: process.env.DB_PASSWORD
//     });
    
//     await connection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
//     await connection.end();

//     // Create tables
//     await createTables();
//     console.log('Database initialized successfully');
//   } catch (error) {
//     console.error('Database initialization failed:', error);
//     throw error;
//   }
// }

// async function createTables() {
//   const connection = await pool.getConnection();
  
//   try {
//     // Users table - Updated with role-based access fields
//     await connection.execute(`
//       CREATE TABLE IF NOT EXISTS users (
//         id VARCHAR(36) PRIMARY KEY,
//         username VARCHAR(255) UNIQUE NOT NULL,
//         password VARCHAR(255) NOT NULL,
//         role ENUM('SUPER_ADMIN', 'COMMAND_ADMIN', 'CONTROLLER', 'OPERATOR') NOT NULL DEFAULT 'OPERATOR',
//         command_number INT DEFAULT 1,
//         operatorCategory VARCHAR(255),
//         operatorCategoryName VARCHAR(255),
//         command VARCHAR(255),
//         commandName VARCHAR(255),
//         division VARCHAR(255),
//         divisionName VARCHAR(255),
//         brigade VARCHAR(255),
//         brigadeName VARCHAR(255),
//         corps VARCHAR(255),
//         corpsName VARCHAR(255),
//         unit VARCHAR(255),
//         -- New fields for role-based access
//         assigned_command VARCHAR(10), -- Command code that this admin manages (ec, wc, sc, etc.)
//         can_access_all_commands BOOLEAN DEFAULT FALSE, -- Only for SUPER_ADMIN
//         is_active BOOLEAN DEFAULT TRUE,
//         createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//       )
//     `);

//     // Command access permissions table
//     await connection.execute(`
//       CREATE TABLE IF NOT EXISTS command_permissions (
//         id VARCHAR(36) PRIMARY KEY,
//         user_id VARCHAR(36) NOT NULL,
//         command_code VARCHAR(10) NOT NULL,
//         permission_type ENUM('READ', 'write', 'delete', 'admin') NOT NULL DEFAULT 'read',
//         granted_by VARCHAR(36), -- User ID who granted this permission
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
//         FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
//         UNIQUE KEY unique_user_command_permission (user_id, command_code, permission_type)
//       )
//     `);

//     // Drone specifications table (updated)
//     await connection.execute(`
//       CREATE TABLE IF NOT EXISTS drone_specs (
//         id VARCHAR(36) PRIMARY KEY,
//         user_id VARCHAR(36) NOT NULL,
//         droneName VARCHAR(255) NOT NULL,
//         quantity INT NOT NULL,
//         frequency DECIMAL(10,3) NOT NULL,
//         clockDrift DECIMAL(10,3) NOT NULL DEFAULT 0,
//         spectralLeakage DECIMAL(10,3) NOT NULL DEFAULT 0,
//         modularshapeId INT NOT NULL DEFAULT 0,
//         maxHeight DECIMAL(10,2) NOT NULL,
//         maxSpeed DECIMAL(10,2) NOT NULL,
//         maxRange DECIMAL(10,2) NOT NULL,
//         maxDuration INT NOT NULL,
//         gpsEnabled ENUM('yes', 'no') NOT NULL,
//         autonomous ENUM('yes', 'no') NOT NULL,
//         controlled ENUM('yes', 'no') NOT NULL,
//         cameraEnabled ENUM('yes', 'no') NOT NULL,
//         cameraResolution VARCHAR(255) DEFAULT '',
//         operatingFrequency VARCHAR(255) DEFAULT '',
//         command_code VARCHAR(10), -- Command this drone belongs to
//         createdAt TIMESTAMP NOT NULL,
//         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
//       )
//     `);

//     // Drone IDs table
//     await connection.execute(`
//       CREATE TABLE IF NOT EXISTS drone_ids (
//         id VARCHAR(36) PRIMARY KEY,
//         drone_spec_id VARCHAR(36) NOT NULL,
//         drone_id VARCHAR(255) NOT NULL,
//         FOREIGN KEY (drone_spec_id) REFERENCES drone_specs(id) ON DELETE CASCADE
//       )
//     `);

//     // Flights table (updated)
//     await connection.execute(`
//       CREATE TABLE IF NOT EXISTS flights (
//         id VARCHAR(36) PRIMARY KEY,
//         user_id VARCHAR(36) NOT NULL,
//         drone_model VARCHAR(255) NOT NULL,
//         drone_class VARCHAR(255) NOT NULL,
//         command_name VARCHAR(255) NOT NULL DEFAULT '',
//         command_code VARCHAR(10), -- Command this flight belongs to
//         frequency DECIMAL(10,3) NOT NULL,
//         clockDrift DECIMAL(10,3) NOT NULL DEFAULT 0,
//         spectralLeakage DECIMAL(10,3) NOT NULL DEFAULT 0,
//         modularshapeId INT NOT NULL DEFAULT 0,
//         purpose TEXT NOT NULL,
//         start DATETIME NOT NULL,
//         end DATETIME NOT NULL,
//         status ENUM('planned', 'active', 'completed') NOT NULL DEFAULT 'planned',
//         cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
//         approved_by VARCHAR(36), -- Admin who approved this flight
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
//         FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
//       )
//     `);

//     // Waypoints table
//     await connection.execute(`
//       CREATE TABLE IF NOT EXISTS waypoints (
//         flight_id VARCHAR(36) NOT NULL,
//         lat DECIMAL(10, 8) NOT NULL,
//         lng DECIMAL(11, 8) NOT NULL,
//         elev INT NOT NULL,
//         sequence INT NOT NULL,
//         FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE
//       )
//     `);

//     // Command hierarchy table for better organization
//     await connection.execute(`
//       CREATE TABLE IF NOT EXISTS command_hierarchy (
//         id VARCHAR(36) PRIMARY KEY,
//         command_code VARCHAR(10) NOT NULL UNIQUE,
//         command_name VARCHAR(255) NOT NULL,
//         command_full_name VARCHAR(255) NOT NULL,
//         headquarters_location VARCHAR(255),
//         latitude DECIMAL(10, 8),
//         longitude DECIMAL(11, 8),
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//       )
//     `);

//     // Insert command hierarchy data
//     await insertCommandHierarchy(connection);

//     console.log('All tables created successfully');
//   } finally {
//     connection.release();
//   }
// }

// async function insertCommandHierarchy(connection) {
//   const commands = [
//     { code: 'ec', name: 'Eastern Command', fullName: 'EASTERN COMMAND', location: 'Kolkata', lat: 33.7738, lng: 76.5762 },
//     { code: 'wc', name: 'Western Command', fullName: 'WESTERN COMMAND', location: 'Chandimandir', lat: 32.7266, lng: 74.8570 },
//     { code: 'sc', name: 'Southern Command', fullName: 'SOUTHERN COMMAND', location: 'Pune', lat: 18.5204, lng: 73.8567 },
//     { code: 'nc', name: 'Northern Command', fullName: 'NORTHERN COMMAND', location: 'Udhampur', lat: 34.0837, lng: 74.7973 },
//     { code: 'swc', name: 'South Western Command', fullName: 'SOUTH WESTERN COMMAND', location: 'Jaipur', lat: 26.9124, lng: 75.7873 },
//     { code: 'anc', name: 'Central Command', fullName: 'CENTRAL COMMAND', location: 'Lucknow', lat: 23.1815, lng: 79.9864 }
//   ];

//   for (const cmd of commands) {
//     await connection.execute(`
//       INSERT INTO command_hierarchy (id, command_code, command_name, command_full_name, headquarters_location, latitude, longitude)
//       VALUES (UUID(), ?, ?, ?, ?, ?, ?)
//       ON DUPLICATE KEY UPDATE 
//         command_name = VALUES(command_name),
//         command_full_name = VALUES(command_full_name),
//         headquarters_location = VALUES(headquarters_location),
//         latitude = VALUES(latitude),
//         longitude = VALUES(longitude)
//     `, [cmd.code, cmd.name, cmd.fullName, cmd.location, cmd.lat, cmd.lng]);
//   }
// }

// // Helper functions for role-based access
// async function getUserCommandAccess(userId) {
//   const connection = await pool.getConnection();
//   try {
//     // Get user's role and assigned command
//     const [users] = await connection.execute(`
//       SELECT role, assigned_command, can_access_all_commands, command
//       FROM users 
//       WHERE id = ?
//     `, [userId]);

//     if (users.length === 0) return null;

//     const user = users[0];
    
//     // Super admin can access all commands
//     if (user.role === 'SUPER_ADMIN' && user.can_access_all_commands) {
//       const [allCommands] = await connection.execute('SELECT command_code FROM command_hierarchy');
//       return allCommands.map(cmd => cmd.command_code);
//     }

//     // Command admin can access their assigned command
//     if (user.role === 'COMMAND_ADMIN' && user.assigned_command) {
//       return [user.assigned_command];
//     }

//     // Operators and controllers can only access their own command
//     if (user.command) {
//       return [user.command];
//     }

//     return [];
//   } finally {
//     connection.release();
//   }
// }

// async function canUserAccessCommand(userId, commandCode) {
//   const accessibleCommands = await getUserCommandAccess(userId);
//   return accessibleCommands.includes(commandCode);
// }

// async function getUsersByCommandAccess(userId) {
//   const connection = await pool.getConnection();
//   try {
//     const accessibleCommands = await getUserCommandAccess(userId);
    
//     if (accessibleCommands.length === 0) {
//       return [];
//     }

//     const placeholders = accessibleCommands.map(() => '?').join(',');
//     const [users] = await connection.execute(`
//       SELECT id, username, role, command_number as commandNumber,
//              operatorCategory, operatorCategoryName, command, commandName,
//              division, divisionName, brigade, brigadeName,
//              corps, corpsName, unit, assigned_command, createdAt
//       FROM users 
//       WHERE command IN (${placeholders}) OR assigned_command IN (${placeholders})
//       ORDER BY createdAt DESC
//     `, [...accessibleCommands, ...accessibleCommands]);

//     return users;
//   } finally {
//     connection.release();
//   }
// }

// async function getFlightsByCommandAccess(userId) {
//   const connection = await pool.getConnection();
//   try {
//     const accessibleCommands = await getUserCommandAccess(userId);
    
//     if (accessibleCommands.length === 0) {
//       return [];
//     }

//     const placeholders = accessibleCommands.map(() => '?').join(',');
//     const [flights] = await connection.execute(`
//       SELECT f.*, u.username, u.commandName as userCommandName
//       FROM flights f
//       JOIN users u ON f.user_id = u.id
//       WHERE f.command_code IN (${placeholders}) OR u.command IN (${placeholders})
//       ORDER BY f.start DESC
//     `, [...accessibleCommands, ...accessibleCommands]);

//     return flights;
//   } finally {
//     connection.release();
//   }
// }

// async function getDroneSpecsByCommandAccess(userId) {
//   const connection = await pool.getConnection();
//   try {
//     const accessibleCommands = await getUserCommandAccess(userId);
    
//     if (accessibleCommands.length === 0) {
//       return [];
//     }

//     const placeholders = accessibleCommands.map(() => '?').join(',');
//     const [specs] = await connection.execute(`
//       SELECT ds.*, u.username, u.unit as userUnit, u.commandName
//       FROM drone_specs ds
//       JOIN users u ON ds.user_id = u.id
//       WHERE ds.command_code IN (${placeholders}) OR u.command IN (${placeholders})
//       ORDER BY ds.createdAt DESC
//     `, [...accessibleCommands, ...accessibleCommands]);

//     // Get drone IDs for each spec
//     for (let spec of specs) {
//       const [droneIds] = await connection.execute(`
//         SELECT drone_id FROM drone_ids 
//         WHERE drone_spec_id = ?
//       `, [spec.id]);
      
//       spec.droneIds = droneIds.map(row => row.drone_id);
//     }

//     return specs;
//   } finally {
//     connection.release();
//   }
// }

// module.exports = { 
//   pool, 
//   initializeDatabase,
//   getUserCommandAccess,
//   canUserAccessCommand,
//   getUsersByCommandAccess,
//   getFlightsByCommandAccess,
//   getDroneSpecsByCommandAccess
// };



// src/config/database.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

async function initializeDatabase() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD
        });

        await connection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
        await connection.end();
        
        await createTables();
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization failed:', error);
        throw error;
    }
}

async function createTables() {
    const connection = await pool.getConnection();
    
    try {
        console.log('Creating database tables...');
        
        // Create all tables with RBAC structure
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(36) PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role ENUM('SUPER_ADMIN', 'COMMAND_ADMIN', 'CONTROLLER', 'OPERATOR') NOT NULL DEFAULT 'OPERATOR',
                command_number INT DEFAULT 1,
                operatorCategory VARCHAR(255),
                operatorCategoryName VARCHAR(255),
                command VARCHAR(255),
                commandName VARCHAR(255),
                division VARCHAR(255),
                divisionName VARCHAR(255),
                brigade VARCHAR(255),
                brigadeName VARCHAR(255),
                corps VARCHAR(255),
                corpsName VARCHAR(255),
                unit VARCHAR(255),
                assigned_command VARCHAR(10),
                can_access_all_commands BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Command permissions table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS command_permissions (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                command_code VARCHAR(10) NOT NULL,
                permission_type ENUM('read', 'write', 'delete', 'admin') NOT NULL DEFAULT 'read',
                granted_by VARCHAR(36),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
                UNIQUE KEY unique_user_command_permission (user_id, command_code, permission_type)
            )
        `);

        // Command hierarchy table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS command_hierarchy (
                id VARCHAR(36) PRIMARY KEY,
                command_code VARCHAR(10) NOT NULL UNIQUE,
                command_name VARCHAR(255) NOT NULL,
                command_full_name VARCHAR(255) NOT NULL,
                headquarters_location VARCHAR(255),
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Enhanced drone specs table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS drone_specs (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                droneName VARCHAR(255) NOT NULL,
                quantity INT NOT NULL,
                frequency DECIMAL(10,3) NOT NULL,
                clockDrift DECIMAL(10,3) NOT NULL DEFAULT 0,
                spectralLeakage DECIMAL(10,3) NOT NULL DEFAULT 0,
                modularshapeId INT NOT NULL DEFAULT 0,
                maxHeight DECIMAL(10,2) NOT NULL,
                maxSpeed DECIMAL(10,2) NOT NULL,
                maxRange DECIMAL(10,2) NOT NULL,
                maxDuration INT NOT NULL,
                gpsEnabled ENUM('yes', 'no') NOT NULL,
                autonomous ENUM('yes', 'no') NOT NULL,
                controlled ENUM('yes', 'no') NOT NULL,
                cameraEnabled ENUM('yes', 'no') NOT NULL,
                cameraResolution VARCHAR(255) DEFAULT '',
                operatingFrequency VARCHAR(255) DEFAULT '',
                command_code VARCHAR(10),
                createdAt TIMESTAMP NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Drone IDs table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS drone_ids (
                id VARCHAR(36) PRIMARY KEY,
                drone_spec_id VARCHAR(36) NOT NULL,
                drone_id VARCHAR(255) NOT NULL,
                FOREIGN KEY (drone_spec_id) REFERENCES drone_specs(id) ON DELETE CASCADE
            )
        `);

        // Enhanced flights table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS flights (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                drone_model VARCHAR(255) NOT NULL,
                drone_class VARCHAR(255) NOT NULL,
                command_name VARCHAR(255) NOT NULL DEFAULT '',
                command_code VARCHAR(10),
                frequency DECIMAL(10,3) NOT NULL,
                clockDrift DECIMAL(10,3) NOT NULL DEFAULT 0,
                spectralLeakage DECIMAL(10,3) NOT NULL DEFAULT 0,
                modularshapeId INT NOT NULL DEFAULT 0,
                purpose TEXT NOT NULL,
                start DATETIME NOT NULL,
                end DATETIME NOT NULL,
                status ENUM('planned', 'active', 'completed') NOT NULL DEFAULT 'planned',
                cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
                approved_by VARCHAR(36),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
            )
        `);

        // Waypoints table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS waypoints (
                flight_id VARCHAR(36) NOT NULL,
                lat DECIMAL(10, 8) NOT NULL,
                lng DECIMAL(11, 8) NOT NULL,
                elev INT NOT NULL,
                sequence INT NOT NULL,
                FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE
            )
        `);

        // Insert command hierarchy data
        await insertCommandHierarchy(connection);
        console.log('All tables created successfully');
        
    } finally {
        connection.release();
    }
}

async function insertCommandHierarchy(connection) {
    const commands = [
        { code: 'ec', name: 'Eastern Command', fullName: 'EASTERN COMMAND', location: 'Kolkata', lat: 22.5726, lng: 88.3639 },
        { code: 'wc', name: 'Western Command', fullName: 'WESTERN COMMAND', location: 'Chandimandir', lat: 30.7333, lng: 76.7794 },
        { code: 'sc', name: 'Southern Command', fullName: 'SOUTHERN COMMAND', location: 'Pune', lat: 18.5204, lng: 73.8567 },
        { code: 'nc', name: 'Northern Command', fullName: 'NORTHERN COMMAND', location: 'Udhampur', lat: 32.9344, lng: 75.1311 },
        { code: 'swc', name: 'South Western Command', fullName: 'SOUTH WESTERN COMMAND', location: 'Jaipur', lat: 26.9124, lng: 75.7873 },
        { code: 'anc', name: 'Central Command', fullName: 'CENTRAL COMMAND', location: 'Lucknow', lat: 26.8467, lng: 80.9462 }
    ];

    for (const cmd of commands) {
        await connection.execute(`
            INSERT INTO command_hierarchy (id, command_code, command_name, command_full_name, headquarters_location, latitude, longitude)
            VALUES (UUID(), ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                command_name = VALUES(command_name),
                command_full_name = VALUES(command_full_name),
                headquarters_location = VALUES(headquarters_location),
                latitude = VALUES(latitude),
                longitude = VALUES(longitude)
        `, [cmd.code, cmd.name, cmd.fullName, cmd.location, cmd.lat, cmd.lng]);
    }
}

// Role-based access helper functions
async function getUserCommandAccess(userId) {
    const connection = await pool.getConnection();
    try {
        const [users] = await connection.execute(`
            SELECT role, assigned_command, can_access_all_commands, command
            FROM users WHERE id = ?
        `, [userId]);

        if (users.length === 0) return null;

        const user = users[0];
        
        if (user.role === 'SUPER_ADMIN' && user.can_access_all_commands) {
            const [allCommands] = await connection.execute('SELECT command_code FROM command_hierarchy');
            return allCommands.map(cmd => cmd.command_code);
        }

        if (user.role === 'COMMAND_ADMIN' && user.assigned_command) {
            return [user.assigned_command];
        }

        if (user.command) {
            return [user.command];
        }

        return [];
    } finally {
        connection.release();
    }
}

async function getUsersByCommandAccess(userId) {
    const connection = await pool.getConnection();
    try {
        const accessibleCommands = await getUserCommandAccess(userId);
        if (accessibleCommands.length === 0) return [];

        const placeholders = accessibleCommands.map(() => '?').join(',');
        const [users] = await connection.execute(`
            SELECT id, username, role, command_number as commandNumber,
                   operatorCategory, operatorCategoryName, command, commandName,
                   division, divisionName, brigade, brigadeName,
                   corps, corpsName, unit, assigned_command, createdAt
            FROM users
            WHERE command IN (${placeholders}) OR assigned_command IN (${placeholders})
            ORDER BY createdAt DESC
        `, [...accessibleCommands, ...accessibleCommands]);

        return users;
    } finally {
        connection.release();
    }
}

async function getFlightsByCommandAccess(userId) {
    const connection = await pool.getConnection();
    try {
        const accessibleCommands = await getUserCommandAccess(userId);
        if (accessibleCommands.length === 0) return [];

        const placeholders = accessibleCommands.map(() => '?').join(',');
        const [flights] = await connection.execute(`
            SELECT f.*, u.username, u.commandName as userCommandName
            FROM flights f
            JOIN users u ON f.user_id = u.id
            WHERE f.command_code IN (${placeholders}) OR u.command IN (${placeholders})
            ORDER BY f.start DESC
        `, [...accessibleCommands, ...accessibleCommands]);

        return flights;
    } finally {
        connection.release();
    }
}

async function getDroneSpecsByCommandAccess(userId) {
    const connection = await pool.getConnection();
    try {
        const accessibleCommands = await getUserCommandAccess(userId);
        if (accessibleCommands.length === 0) return [];

        const placeholders = accessibleCommands.map(() => '?').join(',');
        const [specs] = await connection.execute(`
            SELECT ds.*, u.username, u.unit as userUnit, u.commandName
            FROM drone_specs ds
            JOIN users u ON ds.user_id = u.id
            WHERE ds.command_code IN (${placeholders}) OR u.command IN (${placeholders})
            ORDER BY ds.createdAt DESC
        `, [...accessibleCommands, ...accessibleCommands]);

        for (let spec of specs) {
            const [droneIds] = await connection.execute(`
                SELECT drone_id FROM drone_ids WHERE drone_spec_id = ?
            `, [spec.id]);
            spec.droneIds = droneIds.map(row => row.drone_id);
        }

        return specs;
    } finally {
        connection.release();
    }
}

module.exports = {
    pool,
    initializeDatabase,
    createTables,
    insertCommandHierarchy,
    getUserCommandAccess,
    getUsersByCommandAccess,
    getFlightsByCommandAccess,
    getDroneSpecsByCommandAccess
};