
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
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

async function initializeDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  try {
    console.log('Creating database if not exists...');
    await connection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
    console.log('Database created successfully');
    
    await connection.end();
    await createTables();
    await seedInitialData();
    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

async function createTables() {
  const pool = mysql.createPool(dbConfig);
  const connection = await pool.getConnection();
  
  try {
    console.log('Creating tables...');

    // Users table
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

    // Drone specs table
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

    // Flights table
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

    console.log('All tables created successfully');
  } finally {
    connection.release();
    await pool.end();
  }
}

async function seedInitialData() {
  const pool = mysql.createPool(dbConfig);
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    console.log('Seeding initial data...');

    // Insert command hierarchy data
    const commands = [
      { code: 'ec', name: 'Eastern Command', fullName: 'EASTERN COMMAND', location: 'Kolkata', lat: 22.5726, lng: 88.3639 },
      { code: 'wc', name: 'Western Command', fullName: 'WESTERN COMMAND', location: 'Chandimandir', lat: 30.7333, lng: 76.7794 },
      { code: 'sc', name: 'Southern Command', fullName: 'SOUTHERN COMMAND', location: 'Pune', lat: 18.5204, lng: 73.8567 },
      { code: 'nc', name: 'Northern Command', fullName: 'NORTHERN COMMAND', location: 'Udhampur', lat: 32.9266, lng: 75.1378 },
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

    console.log('Command hierarchy data inserted');

    // Create super admin user
    const superAdminId = uuidv4();
    const superAdminPwd = await bcrypt.hash('admin123', 10);
    
    await connection.execute(`
      INSERT INTO users (
        id, username, password, role, command_number,
        operatorCategory, operatorCategoryName, command, commandName,
        division, divisionName, brigade, brigadeName,
        corps, corpsName, unit, assigned_command, can_access_all_commands, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      superAdminId, 'admin', superAdminPwd, 'SUPER_ADMIN', 1,
      'sa', 'Super Admin', '', '',
      '', '', '', '',
      '', '', 'SYSTEM ADMIN', null, true
    ]);

    console.log('Super admin user created');

    // Create command admins for each command
    const commandAdmins = [
      { code: 'ec', name: 'Eastern Command', username: 'ecadmin', password: '123456' },
      { code: 'wc', name: 'Western Command', username: 'wcadmin', password: '123456' },
      { code: 'sc', name: 'Southern Command', username: 'scadmin', password: '123456' },
      { code: 'nc', name: 'Northern Command', username: 'ncadmin', password: '123456' },
      { code: 'swc', name: 'South Western Command', username: 'swcadmin', password: '123456' },
      { code: 'anc', name: 'Central Command', username: 'ccadmin', password: '123456' }
    ];

    for (let i = 0; i < commandAdmins.length; i++) {
      const admin = commandAdmins[i];
      const adminId = uuidv4();
      const adminPwd = await bcrypt.hash(admin.password, 10);
      
      await connection.execute(`
        INSERT INTO users (
          id, username, password, role, command_number,
          operatorCategory, operatorCategoryName, command, commandName,
          division, divisionName, brigade, brigadeName,
          corps, corpsName, unit, assigned_command, can_access_all_commands, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        adminId, admin.username, adminPwd, 'COMMAND_ADMIN', i + 2,
        'ca', 'Command Admin', admin.code, admin.name,
        '', '', '', '',
        '', '', `${admin.name} HQ`, admin.code, false
      ]);
    }

    console.log('Command admins created');

    // Default operator user
    const userId = uuidv4();
    const userPwd = await bcrypt.hash('user123', 10);
    
    const operatorParams = [
      userId, '67GR', userPwd, 'OPERATOR', 3,
      'a', 'Army', 'sc', 'Southern Command',
      'ar', 'HQ 12 CORPS', 'bde2', '11 RAPID',
      'cor5', '31 INF BDE', '67 FIELD REGIMENT'
    ];
    console.log('Inserting operator user with params:', operatorParams); // Debug log
    await connection.execute(`
      INSERT INTO users (
        id, username, password, role, command_number,
        operatorCategory, operatorCategoryName, command, commandName,
        division, divisionName, brigade, brigadeName,
        corps, corpsName, unit, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, operatorParams);

    // Add sample drone spec
    const droneSpecId = uuidv4();
    const droneSpecParams = [
      droneSpecId, userId, 'MQ-9 Reaper', 1, 1090.0, 0.1, 0.2, 1,
      15000, 50, 100, 120, 'yes', 'yes', 'yes', 'yes',
      '4K', '2.4 GHz to 5.8 GHz'
    ];
    console.log('Inserting drone spec with params:', droneSpecParams); // Debug log
    await connection.execute(`
      INSERT INTO drone_specs (
        id, user_id, droneName, quantity, frequency, clockDrift, spectralLeakage,
        modularshapeId, maxHeight, maxSpeed, maxRange, maxDuration,
        gpsEnabled, autonomous, controlled, cameraEnabled, cameraResolution,
        operatingFrequency, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, droneSpecParams);

    // Add drone ID
    const droneIdEntry = uuidv4();
    await connection.execute(
      'INSERT INTO drone_ids (id, drone_spec_id, drone_id) VALUES (?, ?, ?)',
      [droneIdEntry, droneSpecId, 'DR-001-MQ9']
    );

    // Add sample flight
    const flightId = uuidv4();
    const later = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const flightParams = [
      flightId, userId, 'MQ-9 Reaper', 'MEDIUM', 'SOUTHERN COMMAND',
      1090.0, 0.1, 0.2, 1, 'Recon Alpha', later, 'active'
    ];
    console.log('Inserting flight with params:', flightParams); // Debug log
    await connection.execute(`
      INSERT INTO flights (
        id, user_id, drone_model, drone_class, command_name, frequency,
        clockDrift, spectralLeakage, modularshapeId, purpose, start, end, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)
    `, flightParams);

    // Add sample waypoints
    const waypoints = [
      { lat: 28.6139, lng: 77.2090, elev: 1000 },
      { lat: 28.7041, lng: 77.1025, elev: 1200 },
      { lat: 28.5355, lng: 77.3910, elev: 1100 }
    ];

    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      const waypointParams = [flightId, wp.lat, wp.lng, wp.elev, i + 1];
      console.log('Inserting waypoint with params:', waypointParams); // Debug log
      await connection.execute(
        'INSERT INTO waypoints (flight_id, lat, lng, elev, sequence) VALUES (?, ?, ?, ?, ?)',
        waypointParams
      );
    }

    await connection.commit();
    console.log('Initial data seeded successfully');

  } catch (error) {
    await connection.rollback();
    console.error('Failed to seed data:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

// Main initialization function
async function main() {
  try {
    console.log('Starting RBAC database setup...\n');
    await initializeDatabase();
    console.log('\n=== RBAC Database Setup Complete ===');
    console.log('\nDEFAULT USERS CREATED:');
    console.log('Super Admin - Username: super_admin - Password: superAdmin@2024');
    console.log('\nCOMMAND ADMINS:');
    console.log('EC Admin - Username: admin_ec - Password: ecAdmin@2024');
    console.log('WC Admin - Username: admin_wc - Password: wcAdmin@2024');
    console.log('SC Admin - Username: admin_sc - Password: scAdmin@2024');
    console.log('NC Admin - Username: admin_nc - Password: ncAdmin@2024');
    console.log('SWC Admin - Username: admin_swc - Password: swcAdmin@2024');
    console.log('ANC Admin - Username: admin_anc - Password: ancAdmin@2024');
    console.log('\nSAMPLE OPERATOR:');
    console.log('SC Operator - Username: 67GR - Password: scOperator@2024');
    console.log('\nSetup completed successfully!');
    console.log('You can now start your backend server.');
    process.exit(0);
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = {
  initializeDatabase,
  createTables,
  seedInitialData
};
