
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



// const mysql = require('mysql2/promise');
// const bcrypt = require('bcryptjs');
// const { v4: uuidv4 } = require('uuid');
// const { faker } = require('@faker-js/faker');
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

// // Hierarchy data from your interfaces
// const hierarchyData = {
//   sc: {
//     divisions: {
//       ar: {
//         name: 'HQ 12 CORPS',
//         brigades: {
//           bde1: { name: 'HQ JOSA', corps: [] },
//           bde2: { name: '11 RAPID', corps: ['cor4', 'cor5', 'cor6', 'cor7', 'cor8'] },
//           bde3: { name: '12 RAPID', corps: ['cor9', 'cor10', 'cor11', 'cor12', 'cor13', 'cor14', 'cor15', 'cor16', 'cor17', 'cor18'] },
//         },
//       },
//       cr: {
//         name: 'HQ 21 CORPS',
//         brigades: {
//           bde1: { name: '31 ARMD DIV', corps: ['cor21', 'cor22', 'cor23', 'cor24'] },
//           bde2: { name: '36 RAPID', corps: ['cor25', 'cor26', 'cor27', 'cor28'] },
//           bde3: { name: '41 ARTY DIV', corps: ['cor29', 'cor30', 'cor31'] },
//           bde4: { name: '54 INF DIV', corps: ['cor32', 'cor33', 'cor34', 'cor35', 'cor159', 'cor160', 'cor161'] },
//         },
//       },
//     },
//   },
//   ec: {
//     divisions: {
//       ar: {
//         name: '3 CORPS',
//         brigades: {
//           bde1: { name: '2 MNT DIV', corps: ['cor36', 'cor37', 'cor38', 'cor39'] },
//           bde2: { name: '56 INF DIV', corps: ['cor40', 'cor41', 'cor42', 'cor43'] },
//           bde3: { name: '57 MNT DIV', corps: ['cor44', 'cor45', 'cor46', 'cor47'] },
//         },
//       },
//       br: {
//         name: '4 CORPS',
//         brigades: {
//           bde1: { name: '5 MNT DIV', corps: ['cor48', 'cor49', 'cor50', 'cor51', 'cor52'] },
//           bde2: { name: '21 MTN DIV', corps: [] },
//           bde3: { name: '71 INF DIV', corps: ['cor53', 'cor54', 'cor55', 'cor56', 'cor57'] },
//         },
//       },
//       cr: {
//         name: '33 CORPS',
//         brigades: {
//           bde1: { name: '17 MTN DIV', corps: ['cor58', 'cor59', 'cor60', 'cor61', 'cor62'] },
//           bde2: { name: '20 MTN DIV', corps: ['cor63', 'cor64', 'cor65', 'cor66'] },
//           bde3: { name: '27 MTN DIV', corps: [] },
//           bde4: { name: 'HQ 111 SUB AREA', corps: [] },
//         },
//       },
//       dr: {
//         name: '17 CORPS',
//         brigades: {
//           bde1: { name: '59 INF DIV', corps: ['cor67', 'cor68', 'cor69', 'cor70'] },
//           bde2: { name: '23 INF DIV', corps: ['cor71', 'cor72', 'cor73', 'cor74', 'cor75', 'cor76'] },
//         },
//       },
//     },
//   },
//   wc: {
//     divisions: {
//       ar: {
//         name: 'HQ 2 CORPS',
//         brigades: {
//           bde1: { name: 'HQ 1 ARMD DIV', corps: [] },
//           bde2: { name: 'HQ 9 INF DIV ', corps: ['cor77', 'cor78', 'cor79', 'cor80'] },
//           bde3: { name: 'HQ 22 RAPID DIV(S)', corps: ['cor81', 'cor82', 'cor83', 'cor84', 'cor1111'] },
//           bde4: { name: 'HQ 40 ARTY DIV', corps: ['cor85', 'cor86', 'cor87'] },
//         },
//       },
//       br: {
//         name: 'HQ 9 CORPS',
//         brigades: {
//           bde1: { name: '26 INF DIV', corps: ['cor88', 'cor89', 'cor90', 'cor91', 'cor92'] },
//           bde2: { name: '29 INF DIV ', corps: ['cor93', 'cor94', 'cor95', 'cor96', 'cor97'] },
//         },
//       },
//       cr: {
//         name: 'HQ 11 CORPS',
//         brigades: {
//           bde1: { name: '7 INF DIV ', corps: ['cor99', 'cor100', 'cor101', 'cor102', 'cor103'] },
//           bde2: { name: '15 INF DIV', corps: [] },
//         },
//       },
//     },
//   },
//   nc: {
//     divisions: {
//       ar: {
//         name: '1 CORPS',
//         brigades: {
//           bde1: { name: '4 INF DI', corps: ['cor104', 'cor105', 'cor106', 'cor107'] },
//           bde2: { name: '6 INF DIV', corps: ['cor108', 'cor109', 'cor110', 'cor111'] },
//           bde3: { name: '42 ARTY DIV', corps: ['cor112', 'cor113', 'cor114'] },
//         },
//       },
//       br: {
//         name: '14 CORPS',
//         brigades: {
//           bde1: { name: '3 INF DIV ', corps: ['cor115', 'cor116', 'cor117'] },
//           bde2: { name: '8 MTN DIV', corps: ['cor118', 'cor119', 'cor120', 'cor121'] },
//           bde3: { name: 'UNIFORM FORCE', corps: ['cor122'] },
//         },
//       },
//       cr: {
//         name: '15 CORPS',
//         brigades: {
//           bde1: { name: '19 INF DIV', corps: ['cor123', 'cor124', 'cor125', 'cor126', 'cor127'] },
//           bde2: { name: '26 INF DIV', corps: ['cor128', 'cor129', 'cor130', 'cor131', 'cor132', 'cor133'] },
//         },
//       },
//       dr: {
//         name: '16 CORPS',
//         brigades: {
//           bde1: { name: '10 RAPID', corps: ['cor134', 'cor135', 'cor136', 'cor137', 'cor138'] },
//           bde2: { name: '25 INF DIV', corps: ['cor139', 'cor140', 'cor141', 'cor142', 'cor143'] },
//         },
//       },
//     },
//   },
//   swc: {
//     divisions: {
//       ar: {
//         name: '10 CORPS',
//         brigades: {
//           bde1: { name: '16 RAPID', corps: ['cor144', 'cor145', 'cor146', 'cor147', 'cor148'] },
//           bde2: { name: '18 INF DIV', corps: ['cor149', 'cor150', 'cor151', 'cor152', 'cor153'] },
//           bde3: { name: '24 RAPID', corps: ['cor154', 'cor155', 'cor156', 'cor157', 'cor158'] },
//         },
//       },
//     },
//   },
//   anc: {
//     divisions: {
//       ar: {
//         name: 'HQ 14 INF DIV ',
//         brigades: {
//           bde1: { name: '14 ARTY BDE', corps: [] },
//           bde2: { name: '71 MTN BDE', corps: [] },
//           bde3: { name: '95 INF BDE', corps: [] },
//           bde4: { name: '116 INF BDE', corps: [] },
//         },
//       },
//     },
//   },
// };

// const corpsNames = {
//   cor4: '85 INF BDE', cor5: '31 INF BDE', cor6: '110 ARMD BDE', cor7: '330 INF BDE',
//   cor8: '11 ARTY BDE', cor9: '12 ARTY BDE', cor10: '20 INF BDE', cor11: '30 INF BDE',
//   cor12: '45 INF BDE', cor13: '140 ARMD BDE', cor14: '4(I) ARMD BDE', cor15: '75 (I) INF BDE',
//   cor16: '340 (I) BDE', cor17: '769 (I) MECH BDE', cor18: '12 CAB', cor21: '27 ARMD BDE',
//   cor22: '34 ARMD BDE', cor23: '94 ARMD BDE', cor24: '31 ARTY BDE', cor25: '18 ARMD BDE',
//   cor26: '72 INF BDE', cor27: '115 INF BDE', cor28: '36 ARTY BDE', cor29: '97 ARTY BDE',
//   cor30: '98 ARTY BDE', cor31: '374 COMP ARTY BDE', cor32: '47 INF BDE', cor33: '54 ARTY BDE',
//   cor34: '76 INF BDE', cor35: '91 INF BDE', cor36: '2 ARTY BDE', cor37: '82 MTN BDE',
//   cor38: '117 MTN BDE', cor39: '181 MTN BDE', cor40: '5 INF BDE', cor41: '22 INF BDE',
//   cor42: '56 ARTY BDE', cor43: '103 INF BDE', cor44: '44 MTN BDE', cor45: '57 MTN ARTY BDE',
//   cor46: '59 MTN BDE', cor47: '73 MTN BDE', cor48: '311 MTN BDE', cor49: '351 INF BDE',
//   cor50: '77 MTN BDE', cor51: '5 MTN ARTY BDE', cor52: '190 MTN BDE', cor53: '40 MTN BDE',
//   cor54: '46 INF BDE', cor55: '106 INF BDE', cor56: '71 ARTY BDE', cor57: '604(I) AVN BDE',
//   cor58: '63 MTN BDE', cor59: '64 MTN BDE', cor60: '164 MTN BDE', cor61: '166 MTN BDE',
//   cor62: '17 MTN ARTY BDE', cor63: '20 MTN ARTY BDE', cor64: '66 MTN BDE', cor65: '165 MTN BDE',
//   cor66: '202 MTN BDE', cor67: '59 ARTY BDE', cor68: '122 INF BDE', cor69: '124 INF BDE',
//   cor70: '131 INF BDE', cor71: '61 INF BDE', cor72: '167 INF BDE', cor73: '23 ARTY BDE',
//   cor74: '417 ENGNR BDE', cor75: '17 CORPS ARTY BDE', cor76: '788(I) AD BDE', cor77: '9 ARTY BDE',
//   cor78: '32 INF BDE', cor79: '38 INF BDE', cor80: '42 INF BDE', cor81: '35 INF BDE',
//   cor82: '49 INF BDE', cor83: '60 INF BDE', cor84: '58 ARMD BDE', cor85: '261 ARTY BDE',
//   cor86: '371 CAB', cor87: '372 ARTY BDE', cor88: '26 ARTY BDE', cor89: '19 INF BDE',
//   cor90: '162 INF BDE', cor91: '92 INF BDE', cor92: '36 INF BDE', cor93: '168 INF BDE',
//   cor94: '29 ARTY BDE', cor95: '51 INF BDE', cor96: '78 INF BDE', cor97: '19 INF BDE',
//   cor99: 'SARVATRA BDE', cor100: 'AGNIVAAN BDE', cor101: '37 INF BDE', cor102: 'SEHJRA BDE',
//   cor103: 'BAKRI BDE', cor104: '4 ARTY BDE', cor105: '7 INF BDE', cor106: '41 INF BDE',
//   cor107: '146 INF BDE', cor108: '6 MTN BDE', cor109: '69 MTN BDE', cor110: '99 MTN BDE',
//   cor111: '135 IND BDE', cor112: '72 ARTY BDE', cor113: '99 ARTY BDE', cor114: '373 ARTY BDE',
//   cor115: '81 INF BDE', cor116: '4 SECTOR', cor117: '3 ARTY BDE', cor118: '56 MTN BDE',
//   cor119: '121 (I) INF BDE GP', cor120: '192 MTN BDE', cor121: '8 MTN BDE', cor122: '15 SECT RR',
//   cor123: '17 INF BDE', cor124: '12 INF BDE', cor125: '161 INF BDE', cor126: '19 ARTY BDE',
//   cor127: '79 MTN BDE', cor128: '104 INF BDE', cor129: '268 INF BDE', cor130: '53 INF BDE',
//   cor131: '109 INF BDE', cor132: '68 MTN BDE', cor133: '28 ARTY BDE', cor134: '10 ARTY BDE',
//   cor135: '28 INF BDE', cor136: '52 INF BDE ', cor137: '191 INF BDE', cor138: '130 ARMD BDE',
//   cor139: '93 INF BDE', cor140: '10 INF BDE', cor141: '120 INF BDE', cor142: '80 INF BDE',
//   cor143: '25 ARTY BDE', cor144: '15 INF BDE', cor145: '67 INF BDE', cor146: '89 INF BDE',
//   cor147: '16 ARTY BDE', cor148: '62 ARMD BDE', cor149: '18 ARTY BDE', cor150: '74 INF BDE',
//   cor151: '150 ARMD BDE', cor152: '322 INF BDE', cor153: '83 INF BDE', cor154: '8 INF BDE',
//   cor155: '24 ARTY BDE', cor156: '25 INF BDE', cor157: '170 INF BDE', cor158: '180 ARMD BDE',
//   cor159: '475 ENGR BDE', cor160: '787 (I) AD BDE', cor161: 'HQ 617 (I) AD BDE', cor1111: '22 ARTY BDE',
// };

// const commandNames = {
//   ec: 'Eastern Command',
//   wc: 'Western Command',
//   sc: 'Southern Command',
//   nc: 'Northern Command',
//   swc: 'South Western Command',
//   anc: 'Central Command',
// };

// const unitNames = [
//   '65 FIELD REGIMENT', '66 FIELD REGIMENT', '67 FIELD REGIMENT',
//   '68 FIELD REGIMENT', '69 FIELD REGIMENT', '70 ARTILLERY UNIT',
//   '71 ARTILLERY UNIT', '72 INFANTRY UNIT', '73 INFANTRY UNIT',
//   '74 CAVALRY UNIT', '75 CAVALRY UNIT', '76 SIGNAL UNIT'
// ];

// const operatorCategories = [
//   { code: 'a', name: 'Army' },
//   { code: 'af', name: 'Air Force' },
//   { code: 'n', name: 'Navy' }
// ];

// async function initializeDatabase() {
//   const connection = await mysql.createConnection({
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD
//   });

//   try {
//     console.log('Creating database if not exists...');
//     await connection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
//     console.log('Database created successfully');
    
//     await connection.end();
//     await createTables();
//     await seedInitialData();
//     console.log('Database initialization completed successfully');
//   } catch (error) {
//     console.error('Database initialization failed:', error);
//     throw error;
//   }
// }

// async function createTables() {
//   const pool = mysql.createPool(dbConfig);
//   const connection = await pool.getConnection();
  
//   try {
//     console.log('Creating tables...');

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
//         assigned_command VARCHAR(10),
//         can_access_all_commands BOOLEAN DEFAULT FALSE,
//         is_active BOOLEAN DEFAULT TRUE,
//         createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//       )
//     `);

//     await connection.execute(`
//       CREATE TABLE IF NOT EXISTS command_permissions (
//         id VARCHAR(36) PRIMARY KEY,
//         user_id VARCHAR(36) NOT NULL,
//         command_code VARCHAR(10) NOT NULL,
//         permission_type ENUM('read', 'write', 'delete', 'admin') NOT NULL DEFAULT 'read',
//         granted_by VARCHAR(36),
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
//         FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
//         UNIQUE KEY unique_user_command_permission (user_id, command_code, permission_type)
//       )
//     `);

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
//         command_code VARCHAR(10),
//         createdAt TIMESTAMP NOT NULL,
//         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
//       )
//     `);

//     await connection.execute(`
//       CREATE TABLE IF NOT EXISTS drone_ids (
//         id VARCHAR(36) PRIMARY KEY,
//         drone_spec_id VARCHAR(36) NOT NULL,
//         drone_id VARCHAR(255) NOT NULL,
//         FOREIGN KEY (drone_spec_id) REFERENCES drone_specs(id) ON DELETE CASCADE
//       )
//     `);

//     await connection.execute(`
//       CREATE TABLE IF NOT EXISTS flights (
//         id VARCHAR(36) PRIMARY KEY,
//         user_id VARCHAR(36) NOT NULL,
//         drone_model VARCHAR(255) NOT NULL,
//         drone_class VARCHAR(255) NOT NULL,
//         command_name VARCHAR(255) NOT NULL DEFAULT '',
//         command_code VARCHAR(10),
//         frequency DECIMAL(10,3) NOT NULL,
//         clockDrift DECIMAL(10,3) NOT NULL DEFAULT 0,
//         spectralLeakage DECIMAL(10,3) NOT NULL DEFAULT 0,
//         modularshapeId INT NOT NULL DEFAULT 0,
//         purpose TEXT NOT NULL,
//         start DATETIME NOT NULL,
//         end DATETIME NOT NULL,
//         status ENUM('planned', 'active', 'completed') NOT NULL DEFAULT 'planned',
//         cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
//         approved_by VARCHAR(36),
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
//         FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
//       )
//     `);

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

//     console.log('All tables created successfully');
//   } finally {
//     connection.release();
//     await pool.end();
//   }
// }

// async function seedInitialData() {
//   const pool = mysql.createPool(dbConfig);
//   const connection = await pool.getConnection();
  
//   try {
//     await connection.beginTransaction();
//     console.log('Seeding initial data...');

//     // Insert command hierarchy
//     const commands = [
//       { code: 'ec', name: 'Eastern Command', fullName: 'EASTERN COMMAND', location: 'Kolkata', lat: 22.5726, lng: 88.3639 },
//       { code: 'wc', name: 'Western Command', fullName: 'WESTERN COMMAND', location: 'Chandimandir', lat: 30.7333, lng: 76.7794 },
//       { code: 'sc', name: 'Southern Command', fullName: 'SOUTHERN COMMAND', location: 'Pune', lat: 18.5204, lng: 73.8567 },
//       { code: 'nc', name: 'Northern Command', fullName: 'NORTHERN COMMAND', location: 'Udhampur', lat: 32.9266, lng: 75.1378 },
//       { code: 'swc', name: 'South Western Command', fullName: 'SOUTH WESTERN COMMAND', location: 'Jaipur', lat: 26.9124, lng: 75.7873 },
//       { code: 'anc', name: 'Central Command', fullName: 'CENTRAL COMMAND', location: 'Lucknow', lat: 26.8467, lng: 80.9462 }
//     ];

//     for (const cmd of commands) {
//       await connection.execute(`
//         INSERT INTO command_hierarchy (id, command_code, command_name, command_full_name, headquarters_location, latitude, longitude)
//         VALUES (UUID(), ?, ?, ?, ?, ?, ?)
//         ON DUPLICATE KEY UPDATE
//         command_name = VALUES(command_name),
//         command_full_name = VALUES(command_full_name),
//         headquarters_location = VALUES(headquarters_location),
//         latitude = VALUES(latitude),
//         longitude = VALUES(longitude)
//       `, [cmd.code, cmd.name, cmd.fullName, cmd.location, cmd.lat, cmd.lng]);
//     }

//     console.log('Command hierarchy data inserted');

//     // Create super admin
//     const superAdminId = uuidv4();
//     const superAdminPwd = await bcrypt.hash('admin123', 10);
    
//     await connection.execute(`
//       INSERT INTO users (
//         id, username, password, role, command_number,
//         operatorCategory, operatorCategoryName, command, commandName,
//         division, divisionName, brigade, brigadeName,
//         corps, corpsName, unit, assigned_command, can_access_all_commands, createdAt
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//     `, [
//       superAdminId, 'admin', superAdminPwd, 'SUPER_ADMIN', 1,
//       'sa', 'Super Admin', '', '',
//       '', '', '', '',
//       '', '', 'SYSTEM ADMIN', null, true
//     ]);

//     console.log('Super admin user created');

//     // Create command admins
//     const commandAdmins = [
//       { code: 'ec', name: 'Eastern Command', username: 'ecadmin', password: '123456' },
//       { code: 'wc', name: 'Western Command', username: 'wcadmin', password: '123456' },
//       { code: 'sc', name: 'Southern Command', username: 'scadmin', password: '123456' },
//       { code: 'nc', name: 'Northern Command', username: 'ncadmin', password: '123456' },
//       { code: 'swc', name: 'South Western Command', username: 'swcadmin', password: '123456' },
//       { code: 'anc', name: 'Central Command', username: 'ccadmin', password: '123456' }
//     ];

//     for (let i = 0; i < commandAdmins.length; i++) {
//       const admin = commandAdmins[i];
//       const adminId = uuidv4();
//       const adminPwd = await bcrypt.hash(admin.password, 10);
      
//       await connection.execute(`
//         INSERT INTO users (
//           id, username, password, role, command_number,
//           operatorCategory, operatorCategoryName, command, commandName,
//           division, divisionName, brigade, brigadeName,
//           corps, corpsName, unit, assigned_command, can_access_all_commands, createdAt
//         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//       `, [
//         adminId, admin.username, adminPwd, 'COMMAND_ADMIN', i + 2,
//         'ca', 'Command Admin', admin.code, admin.name,
//         '', '', '', '',
//         '', '', `${admin.name} HQ`, admin.code, false
//       ]);
//     }

//     console.log('Command admins created');

//     // Generate operators distributed across hierarchy
//     const droneModels = ['MQ-9 Reaper', 'DJI Mavic 3', 'Parrot Anafi', 'Autel Evo II', 'Skydio 2'];
//     const droneClasses = ['SMALL', 'MEDIUM', 'LARGE'];
//     const purposes = ['Recon Alpha', 'Surveillance Beta', 'Patrol Gamma', 'Training Delta', 'Inspection Epsilon'];
//     const gpsOptions = ['yes', 'no'];
//     const yesNoOptions = ['yes', 'no'];
//     const cameraResolutions = ['4K', '1080p', '720p', '8K'];
//     const operatingFrequencies = ['2.4 GHz to 5.8 GHz', '900 MHz', '1.2 GHz', '5 GHz'];

//     let totalUsers = 0;
//     let commandCounter = 10;

//     // Loop through each command
//     for (const [cmdCode, cmdData] of Object.entries(hierarchyData)) {
//       console.log(`\nProcessing command: ${commandNames[cmdCode]}`);
      
//       // Loop through each division
//       for (const [divCode, divData] of Object.entries(cmdData.divisions)) {
//         console.log(`  Division: ${divData.name}`);
        
//         // Loop through each brigade
//         for (const [bdeCode, bdeData] of Object.entries(divData.brigades)) {
//           if (!bdeData.name) continue; // Skip empty brigades
          
//           console.log(`    Brigade: ${bdeData.name}`);
          
//           // If brigade has corps, create users in each corps
//           if (bdeData.corps && bdeData.corps.length > 0) {
//             for (const corpsCode of bdeData.corps) {
//               const corpsName = corpsNames[corpsCode] || 'Unknown Corps';
              
//               // Create 10-15 users per corps
//               const usersInCorps = faker.number.int({ min: 10, max: 15 });
              
//               for (let u = 0; u < usersInCorps; u++) {
//                 const userId = uuidv4();
//                 const username = `${cmdCode}_${divCode}_${bdeCode}_${corpsCode}_${u + 1}`;
//                 const userPwd = await bcrypt.hash('operator123', 10);
//                 const category = faker.helpers.arrayElement(operatorCategories);
//                 const unit = faker.helpers.arrayElement(unitNames);

//                 await connection.execute(`
//                   INSERT INTO users (
//                     id, username, password, role, command_number,
//                     operatorCategory, operatorCategoryName, command, commandName,
//                     division, divisionName, brigade, brigadeName,
//                     corps, corpsName, unit, createdAt
//                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//                 `, [
//                   userId, username, userPwd, 'OPERATOR', commandCounter++,
//                   category.code, category.name, cmdCode, commandNames[cmdCode],
//                   divCode, divData.name, bdeCode, bdeData.name,
//                   corpsCode, corpsName, unit
//                 ]);

//                 totalUsers++;

//                 // Add 1-3 drone specs per operator (randomly)
//                 const numDrones = faker.number.int({ min: 1, max: 3 });
//                 for (let d = 0; d < numDrones; d++) {
//                   const droneSpecId = uuidv4();
//                   const droneName = faker.helpers.arrayElement(droneModels);
//                   const quantity = faker.number.int({ min: 1, max: 5 });
//                   const frequency = faker.number.float({ min: 900, max: 1200, fractionDigits: 3 });
//                   const clockDrift = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//                   const spectralLeakage = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//                   const modularshapeId = faker.number.int({ min: 0, max: 5 });
//                   const maxHeight = faker.number.float({ min: 1000, max: 20000, fractionDigits: 2 });
//                   const maxSpeed = faker.number.float({ min: 20, max: 100, fractionDigits: 2 });
//                   const maxRange = faker.number.float({ min: 50, max: 500, fractionDigits: 2 });
//                   const maxDuration = faker.number.int({ min: 30, max: 300 });
//                   const gpsEnabled = faker.helpers.arrayElement(gpsOptions);
//                   const autonomous = faker.helpers.arrayElement(yesNoOptions);
//                   const controlled = faker.helpers.arrayElement(yesNoOptions);
//                   const cameraEnabled = faker.helpers.arrayElement(yesNoOptions);
//                   const cameraResolution = faker.helpers.arrayElement(cameraResolutions);
//                   const operatingFrequency = faker.helpers.arrayElement(operatingFrequencies);

//                   await connection.execute(`
//                     INSERT INTO drone_specs (
//                       id, user_id, droneName, quantity, frequency, clockDrift, spectralLeakage,
//                       modularshapeId, maxHeight, maxSpeed, maxRange, maxDuration,
//                       gpsEnabled, autonomous, controlled, cameraEnabled, cameraResolution,
//                       operatingFrequency, command_code, createdAt
//                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//                   `, [
//                     droneSpecId, userId, droneName, quantity, frequency, clockDrift, spectralLeakage,
//                     modularshapeId, maxHeight, maxSpeed, maxRange, maxDuration,
//                     gpsEnabled, autonomous, controlled, cameraEnabled, cameraResolution,
//                     operatingFrequency, cmdCode
//                   ]);

//                   // Add 1-3 drone IDs per spec
//                   const numDroneIds = faker.number.int({ min: 1, max: 3 });
//                   for (let idIndex = 0; idIndex < numDroneIds; idIndex++) {
//                     const droneIdEntry = uuidv4();
//                     const droneId = `DR-${faker.number.int({ min: 100, max: 999 })}-${droneName.replace(/\s/g, '')}`;

//                     await connection.execute(
//                       'INSERT INTO drone_ids (id, drone_spec_id, drone_id) VALUES (?, ?, ?)',
//                       [droneIdEntry, droneSpecId, droneId]
//                     );
//                   }
//                 }

//                 // Add 2-4 flights per operator
//                 const numFlights = faker.number.int({ min: 2, max: 4 });
//                 for (let f = 0; f < numFlights; f++) {
//                   const flightId = uuidv4();
//                   const droneModel = faker.helpers.arrayElement(droneModels);
//                   const droneClass = faker.helpers.arrayElement(droneClasses);
//                   const frequency = faker.number.float({ min: 900, max: 1200, fractionDigits: 3 });
//                   const clockDrift = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//                   const spectralLeakage = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//                   const modularshapeId = faker.number.int({ min: 0, max: 5 });
//                   const purpose = faker.helpers.arrayElement(purposes);
//                   const start = faker.date.future();
//                   const end = new Date(start.getTime() + faker.number.int({ min: 3600000, max: 86400000 }));
//                   const status = faker.helpers.arrayElement(['planned', 'active', 'completed']);
//                   const cancelRequested = faker.datatype.boolean();

//                   await connection.execute(`
//                     INSERT INTO flights (
//                       id, user_id, drone_model, drone_class, command_name, command_code, frequency,
//                       clockDrift, spectralLeakage, modularshapeId, purpose, start, end, status,
//                       cancel_requested, created_at
//                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//                   `, [
//                     flightId, userId, droneModel, droneClass, commandNames[cmdCode], cmdCode,
//                     frequency, clockDrift, spectralLeakage, modularshapeId, purpose,
//                     start, end, status, cancelRequested
//                   ]);

//                   // Add 3-8 waypoints per flight
//                   const numWaypoints = faker.number.int({ min: 3, max: 8 });
//                   for (let w = 0; w < numWaypoints; w++) {
//                     const lat = faker.location.latitude();
//                     const lng = faker.location.longitude();
//                     const elev = faker.number.int({ min: 500, max: 5000 });
//                     const sequence = w + 1;

//                     await connection.execute(
//                       'INSERT INTO waypoints (flight_id, lat, lng, elev, sequence) VALUES (?, ?, ?, ?, ?)',
//                       [flightId, lat, lng, elev, sequence]
//                     );
//                   }
//                 }
//               }
//               console.log(`      Corps ${corpsName}: Created ${usersInCorps} users`);
//             }
//           } else {
//             // Brigade has no corps, create users directly in brigade
//             const usersInBrigade = faker.number.int({ min: 10, max: 15 });
            
//             for (let u = 0; u < usersInBrigade; u++) {
//               const userId = uuidv4();
//               const username = `${cmdCode}_${divCode}_${bdeCode}_${u + 1}`;
//               const userPwd = await bcrypt.hash('operator123', 10);
//               const category = faker.helpers.arrayElement(operatorCategories);
//               const unit = faker.helpers.arrayElement(unitNames);

//               await connection.execute(`
//                 INSERT INTO users (
//                   id, username, password, role, command_number,
//                   operatorCategory, operatorCategoryName, command, commandName,
//                   division, divisionName, brigade, brigadeName,
//                   corps, corpsName, unit, createdAt
//                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//               `, [
//                 userId, username, userPwd, 'OPERATOR', commandCounter++,
//                 category.code, category.name, cmdCode, commandNames[cmdCode],
//                 divCode, divData.name, bdeCode, bdeData.name,
//                 '', '', unit
//               ]);

//               totalUsers++;

//               // Add 1-3 drone specs per operator
//               const numDrones = faker.number.int({ min: 1, max: 3 });
//               for (let d = 0; d < numDrones; d++) {
//                 const droneSpecId = uuidv4();
//                 const droneName = faker.helpers.arrayElement(droneModels);
//                 const quantity = faker.number.int({ min: 1, max: 5 });
//                 const frequency = faker.number.float({ min: 900, max: 1200, fractionDigits: 3 });
//                 const clockDrift = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//                 const spectralLeakage = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//                 const modularshapeId = faker.number.int({ min: 0, max: 5 });
//                 const maxHeight = faker.number.float({ min: 1000, max: 20000, fractionDigits: 2 });
//                 const maxSpeed = faker.number.float({ min: 20, max: 100, fractionDigits: 2 });
//                 const maxRange = faker.number.float({ min: 50, max: 500, fractionDigits: 2 });
//                 const maxDuration = faker.number.int({ min: 30, max: 300 });
//                 const gpsEnabled = faker.helpers.arrayElement(gpsOptions);
//                 const autonomous = faker.helpers.arrayElement(yesNoOptions);
//                 const controlled = faker.helpers.arrayElement(yesNoOptions);
//                 const cameraEnabled = faker.helpers.arrayElement(yesNoOptions);
//                 const cameraResolution = faker.helpers.arrayElement(cameraResolutions);
//                 const operatingFrequency = faker.helpers.arrayElement(operatingFrequencies);

//                 await connection.execute(`
//                   INSERT INTO drone_specs (
//                     id, user_id, droneName, quantity, frequency, clockDrift, spectralLeakage,
//                     modularshapeId, maxHeight, maxSpeed, maxRange, maxDuration,
//                     gpsEnabled, autonomous, controlled, cameraEnabled, cameraResolution,
//                     operatingFrequency, command_code, createdAt
//                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//                 `, [
//                   droneSpecId, userId, droneName, quantity, frequency, clockDrift, spectralLeakage,
//                   modularshapeId, maxHeight, maxSpeed, maxRange, maxDuration,
//                   gpsEnabled, autonomous, controlled, cameraEnabled, cameraResolution,
//                   operatingFrequency, cmdCode
//                 ]);

//                 // Add 1-3 drone IDs per spec
//                 const numDroneIds = faker.number.int({ min: 1, max: 3 });
//                 for (let idIndex = 0; idIndex < numDroneIds; idIndex++) {
//                   const droneIdEntry = uuidv4();
//                   const droneId = `DR-${faker.number.int({ min: 100, max: 999 })}-${droneName.replace(/\s/g, '')}`;

//                   await connection.execute(
//                     'INSERT INTO drone_ids (id, drone_spec_id, drone_id) VALUES (?, ?, ?)',
//                     [droneIdEntry, droneSpecId, droneId]
//                   );
//                 }
//               }

//               // Add 2-4 flights per operator
//               const numFlights = faker.number.int({ min: 2, max: 4 });
//               for (let f = 0; f < numFlights; f++) {
//                 const flightId = uuidv4();
//                 const droneModel = faker.helpers.arrayElement(droneModels);
//                 const droneClass = faker.helpers.arrayElement(droneClasses);
//                 const frequency = faker.number.float({ min: 900, max: 1200, fractionDigits: 3 });
//                 const clockDrift = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//                 const spectralLeakage = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//                 const modularshapeId = faker.number.int({ min: 0, max: 5 });
//                 const purpose = faker.helpers.arrayElement(purposes);
//                 const start = faker.date.future();
//                 const end = new Date(start.getTime() + faker.number.int({ min: 3600000, max: 86400000 }));
//                 const status = faker.helpers.arrayElement(['planned', 'active', 'completed']);
//                 const cancelRequested = faker.datatype.boolean();

//                 await connection.execute(`
//                   INSERT INTO flights (
//                     id, user_id, drone_model, drone_class, command_name, command_code, frequency,
//                     clockDrift, spectralLeakage, modularshapeId, purpose, start, end, status,
//                     cancel_requested, created_at
//                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//                 `, [
//                   flightId, userId, droneModel, droneClass, commandNames[cmdCode], cmdCode,
//                   frequency, clockDrift, spectralLeakage, modularshapeId, purpose,
//                   start, end, status, cancelRequested
//                 ]);

//                 // Add 3-8 waypoints per flight
//                 const numWaypoints = faker.number.int({ min: 3, max: 8 });
//                 for (let w = 0; w < numWaypoints; w++) {
//                   const lat = faker.location.latitude();
//                   const lng = faker.location.longitude();
//                   const elev = faker.number.int({ min: 500, max: 5000 });
//                   const sequence = w + 1;

//                   await connection.execute(
//                     'INSERT INTO waypoints (flight_id, lat, lng, elev, sequence) VALUES (?, ?, ?, ?, ?)',
//                     [flightId, lat, lng, elev, sequence]
//                   );
//                 }
//               }
//             }
//             console.log(`      Brigade ${bdeData.name}: Created ${usersInBrigade} users (no corps)`);
//           }
//         }
//       }
//     }

//     await connection.commit();
//     console.log(`\n✅ Initial data seeded successfully!`);
//     console.log(`\n📊 Summary:`);
//     console.log(`   Total Operators Created: ${totalUsers}`);
//     console.log(`   Distribution: 10-15 users per Corps/Brigade`);
//     console.log(`   Drones per Operator: 1-3 (random)`);
//     console.log(`   Flights per Operator: 2-4`);

//   } catch (error) {
//     await connection.rollback();
//     console.error('Failed to seed data:', error);
//     throw error;
//   } finally {
//     connection.release();
//     await pool.end();
//   }
// }

// async function main() {
//   try {
//     console.log('Starting RBAC database setup...\n');
//     await initializeDatabase();
//     console.log('\n=== RBAC Database Setup Complete ===');
//     console.log('\nDEFAULT CREDENTIALS:');
//     console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
//     console.log('\n🔑 Super Admin:');
//     console.log('   Username: admin');
//     console.log('   Password: admin123');
//     console.log('\n🔑 Command Admins:');
//     console.log('   EC Admin - Username: ecadmin  - Password: 123456');
//     console.log('   WC Admin - Username: wcadmin  - Password: 123456');
//     console.log('   SC Admin - Username: scadmin  - Password: 123456');
//     console.log('   NC Admin - Username: ncadmin  - Password: 123456');
//     console.log('   SWC Admin - Username: swcadmin - Password: 123456');
//     console.log('   Central Admin - Username: ccadmin  - Password: 123456');
//     console.log('\n🔑 Operators:');
//     console.log('   All operators - Password: operator123');
//     console.log('   Username format: <cmd>_<div>_<bde>_<corps>_<number>');
//     console.log('   Example: ec_ar_bde1_cor36_1');
//     console.log('\n✨ Setup completed successfully!');
//     console.log('You can now start your backend server.');
//     process.exit(0);
//   } catch (error) {
//     console.error('Setup failed:', error);
//     process.exit(1);
//   }
// }

// if (require.main === module) {
//   main();
// }

// module.exports = {
//   initializeDatabase,
//   createTables,
//   seedInitialData
// }




// const mysql = require('mysql2/promise');
// const bcrypt = require('bcryptjs');
// const { v4: uuidv4 } = require('uuid');
// const { faker } = require('@faker-js/faker');
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

// // Hierarchy data from your interfaces
// const hierarchyData = {
//   sc: {
//     divisions: {
//       ar: {
//         name: 'HQ 12 CORPS',
//         brigades: {
//           bde1: { name: 'HQ JOSA', corps: [] },
//           bde2: { name: '11 RAPID', corps: ['cor4', 'cor5', 'cor6', 'cor7', 'cor8'] },
//           bde3: { name: '12 RAPID', corps: ['cor9', 'cor10', 'cor11', 'cor12', 'cor13', 'cor14', 'cor15', 'cor16', 'cor17', 'cor18'] },
//         },
//       },
//       cr: {
//         name: 'HQ 21 CORPS',
//         brigades: {
//           bde1: { name: '31 ARMD DIV', corps: ['cor21', 'cor22', 'cor23', 'cor24'] },
//           bde2: { name: '36 RAPID', corps: ['cor25', 'cor26', 'cor27', 'cor28'] },
//           bde3: { name: '41 ARTY DIV', corps: ['cor29', 'cor30', 'cor31'] },
//           bde4: { name: '54 INF DIV', corps: ['cor32', 'cor33', 'cor34', 'cor35', 'cor159', 'cor160', 'cor161'] },
//         },
//       },
//     },
//   },
//   ec: {
//     divisions: {
//       ar: {
//         name: '3 CORPS',
//         brigades: {
//           bde1: { name: '2 MNT DIV', corps: ['cor36', 'cor37', 'cor38', 'cor39'] },
//           bde2: { name: '56 INF DIV', corps: ['cor40', 'cor41', 'cor42', 'cor43'] },
//           bde3: { name: '57 MNT DIV', corps: ['cor44', 'cor45', 'cor46', 'cor47'] },
//         },
//       },
//       br: {
//         name: '4 CORPS',
//         brigades: {
//           bde1: { name: '5 MNT DIV', corps: ['cor48', 'cor49', 'cor50', 'cor51', 'cor52'] },
//           bde2: { name: '21 MTN DIV', corps: [] },
//           bde3: { name: '71 INF DIV', corps: ['cor53', 'cor54', 'cor55', 'cor56', 'cor57'] },
//         },
//       },
//       cr: {
//         name: '33 CORPS',
//         brigades: {
//           bde1: { name: '17 MTN DIV', corps: ['cor58', 'cor59', 'cor60', 'cor61', 'cor62'] },
//           bde2: { name: '20 MTN DIV', corps: ['cor63', 'cor64', 'cor65', 'cor66'] },
//           bde3: { name: '27 MTN DIV', corps: [] },
//           bde4: { name: 'HQ 111 SUB AREA', corps: [] },
//         },
//       },
//       dr: {
//         name: '17 CORPS',
//         brigades: {
//           bde1: { name: '59 INF DIV', corps: ['cor67', 'cor68', 'cor69', 'cor70'] },
//           bde2: { name: '23 INF DIV', corps: ['cor71', 'cor72', 'cor73', 'cor74', 'cor75', 'cor76'] },
//         },
//       },
//     },
//   },
//   wc: {
//     divisions: {
//       ar: {
//         name: 'HQ 2 CORPS',
//         brigades: {
//           bde1: { name: 'HQ 1 ARMD DIV', corps: [] },
//           bde2: { name: 'HQ 9 INF DIV ', corps: ['cor77', 'cor78', 'cor79', 'cor80'] },
//           bde3: { name: 'HQ 22 RAPID DIV(S)', corps: ['cor81', 'cor82', 'cor83', 'cor84', 'cor1111'] },
//           bde4: { name: 'HQ 40 ARTY DIV', corps: ['cor85', 'cor86', 'cor87'] },
//         },
//       },
//       br: {
//         name: 'HQ 9 CORPS',
//         brigades: {
//           bde1: { name: '26 INF DIV', corps: ['cor88', 'cor89', 'cor90', 'cor91', 'cor92'] },
//           bde2: { name: '29 INF DIV ', corps: ['cor93', 'cor94', 'cor95', 'cor96', 'cor97'] },
//         },
//       },
//       cr: {
//         name: 'HQ 11 CORPS',
//         brigades: {
//           bde1: { name: '7 INF DIV ', corps: ['cor99', 'cor100', 'cor101', 'cor102', 'cor103'] },
//           bde2: { name: '15 INF DIV', corps: [] },
//         },
//       },
//     },
//   },
//   nc: {
//     divisions: {
//       ar: {
//         name: '1 CORPS',
//         brigades: {
//           bde1: { name: '4 INF DI', corps: ['cor104', 'cor105', 'cor106', 'cor107'] },
//           bde2: { name: '6 INF DIV', corps: ['cor108', 'cor109', 'cor110', 'cor111'] },
//           bde3: { name: '42 ARTY DIV', corps: ['cor112', 'cor113', 'cor114'] },
//         },
//       },
//       br: {
//         name: '14 CORPS',
//         brigades: {
//           bde1: { name: '3 INF DIV ', corps: ['cor115', 'cor116', 'cor117'] },
//           bde2: { name: '8 MTN DIV', corps: ['cor118', 'cor119', 'cor120', 'cor121'] },
//           bde3: { name: 'UNIFORM FORCE', corps: ['cor122'] },
//         },
//       },
//       cr: {
//         name: '15 CORPS',
//         brigades: {
//           bde1: { name: '19 INF DIV', corps: ['cor123', 'cor124', 'cor125', 'cor126', 'cor127'] },
//           bde2: { name: '26 INF DIV', corps: ['cor128', 'cor129', 'cor130', 'cor131', 'cor132', 'cor133'] },
//         },
//       },
//       dr: {
//         name: '16 CORPS',
//         brigades: {
//           bde1: { name: '10 RAPID', corps: ['cor134', 'cor135', 'cor136', 'cor137', 'cor138'] },
//           bde2: { name: '25 INF DIV', corps: ['cor139', 'cor140', 'cor141', 'cor142', 'cor143'] },
//         },
//       },
//     },
//   },
//   swc: {
//     divisions: {
//       ar: {
//         name: '10 CORPS',
//         brigades: {
//           bde1: { name: '16 RAPID', corps: ['cor144', 'cor145', 'cor146', 'cor147', 'cor148'] },
//           bde2: { name: '18 INF DIV', corps: ['cor149', 'cor150', 'cor151', 'cor152', 'cor153'] },
//           bde3: { name: '24 RAPID', corps: ['cor154', 'cor155', 'cor156', 'cor157', 'cor158'] },
//         },
//       },
//     },
//   },
//   anc: {
//     divisions: {
//       ar: {
//         name: 'HQ 14 INF DIV ',
//         brigades: {
//           bde1: { name: '14 ARTY BDE', corps: [] },
//           bde2: { name: '71 MTN BDE', corps: [] },
//           bde3: { name: '95 INF BDE', corps: [] },
//           bde4: { name: '116 INF BDE', corps: [] },
//         },
//       },
//     },
//   },
// };

// const corpsNames = {
//   cor4: '85 INF BDE', cor5: '31 INF BDE', cor6: '110 ARMD BDE', cor7: '330 INF BDE',
//   cor8: '11 ARTY BDE', cor9: '12 ARTY BDE', cor10: '20 INF BDE', cor11: '30 INF BDE',
//   cor12: '45 INF BDE', cor13: '140 ARMD BDE', cor14: '4(I) ARMD BDE', cor15: '75 (I) INF BDE',
//   cor16: '340 (I) BDE', cor17: '769 (I) MECH BDE', cor18: '12 CAB', cor21: '27 ARMD BDE',
//   cor22: '34 ARMD BDE', cor23: '94 ARMD BDE', cor24: '31 ARTY BDE', cor25: '18 ARMD BDE',
//   cor26: '72 INF BDE', cor27: '115 INF BDE', cor28: '36 ARTY BDE', cor29: '97 ARTY BDE',
//   cor30: '98 ARTY BDE', cor31: '374 COMP ARTY BDE', cor32: '47 INF BDE', cor33: '54 ARTY BDE',
//   cor34: '76 INF BDE', cor35: '91 INF BDE', cor36: '2 ARTY BDE', cor37: '82 MTN BDE',
//   cor38: '117 MTN BDE', cor39: '181 MTN BDE', cor40: '5 INF BDE', cor41: '22 INF BDE',
//   cor42: '56 ARTY BDE', cor43: '103 INF BDE', cor44: '44 MTN BDE', cor45: '57 MTN ARTY BDE',
//   cor46: '59 MTN BDE', cor47: '73 MTN BDE', cor48: '311 MTN BDE', cor49: '351 INF BDE',
//   cor50: '77 MTN BDE', cor51: '5 MTN ARTY BDE', cor52: '190 MTN BDE', cor53: '40 MTN BDE',
//   cor54: '46 INF BDE', cor55: '106 INF BDE', cor56: '71 ARTY BDE', cor57: '604(I) AVN BDE',
//   cor58: '63 MTN BDE', cor59: '64 MTN BDE', cor60: '164 MTN BDE', cor61: '166 MTN BDE',
//   cor62: '17 MTN ARTY BDE', cor63: '20 MTN ARTY BDE', cor64: '66 MTN BDE', cor65: '165 MTN BDE',
//   cor66: '202 MTN BDE', cor67: '59 ARTY BDE', cor68: '122 INF BDE', cor69: '124 INF BDE',
//   cor70: '131 INF BDE', cor71: '61 INF BDE', cor72: '167 INF BDE', cor73: '23 ARTY BDE',
//   cor74: '417 ENGNR BDE', cor75: '17 CORPS ARTY BDE', cor76: '788(I) AD BDE', cor77: '9 ARTY BDE',
//   cor78: '32 INF BDE', cor79: '38 INF BDE', cor80: '42 INF BDE', cor81: '35 INF BDE',
//   cor82: '49 INF BDE', cor83: '60 INF BDE', cor84: '58 ARMD BDE', cor85: '261 ARTY BDE',
//   cor86: '371 CAB', cor87: '372 ARTY BDE', cor88: '26 ARTY BDE', cor89: '19 INF BDE',
//   cor90: '162 INF BDE', cor91: '92 INF BDE', cor92: '36 INF BDE', cor93: '168 INF BDE',
//   cor94: '29 ARTY BDE', cor95: '51 INF BDE', cor96: '78 INF BDE', cor97: '19 INF BDE',
//   cor99: 'SARVATRA BDE', cor100: 'AGNIVAAN BDE', cor101: '37 INF BDE', cor102: 'SEHJRA BDE',
//   cor103: 'BAKRI BDE', cor104: '4 ARTY BDE', cor105: '7 INF BDE', cor106: '41 INF BDE',
//   cor107: '146 INF BDE', cor108: '6 MTN BDE', cor109: '69 MTN BDE', cor110: '99 MTN BDE',
//   cor111: '135 IND BDE', cor112: '72 ARTY BDE', cor113: '99 ARTY BDE', cor114: '373 ARTY BDE',
//   cor115: '81 INF BDE', cor116: '4 SECTOR', cor117: '3 ARTY BDE', cor118: '56 MTN BDE',
//   cor119: '121 (I) INF BDE GP', cor120: '192 MTN BDE', cor121: '8 MTN BDE', cor122: '15 SECT RR',
//   cor123: '17 INF BDE', cor124: '12 INF BDE', cor125: '161 INF BDE', cor126: '19 ARTY BDE',
//   cor127: '79 MTN BDE', cor128: '104 INF BDE', cor129: '268 INF BDE', cor130: '53 INF BDE',
//   cor131: '109 INF BDE', cor132: '68 MTN BDE', cor133: '28 ARTY BDE', cor134: '10 ARTY BDE',
//   cor135: '28 INF BDE', cor136: '52 INF BDE ', cor137: '191 INF BDE', cor138: '130 ARMD BDE',
//   cor139: '93 INF BDE', cor140: '10 INF BDE', cor141: '120 INF BDE', cor142: '80 INF BDE',
//   cor143: '25 ARTY BDE', cor144: '15 INF BDE', cor145: '67 INF BDE', cor146: '89 INF BDE',
//   cor147: '16 ARTY BDE', cor148: '62 ARMD BDE', cor149: '18 ARTY BDE', cor150: '74 INF BDE',
//   cor151: '150 ARMD BDE', cor152: '322 INF BDE', cor153: '83 INF BDE', cor154: '8 INF BDE',
//   cor155: '24 ARTY BDE', cor156: '25 INF BDE', cor157: '170 INF BDE', cor158: '180 ARMD BDE',
//   cor159: '475 ENGR BDE', cor160: '787 (I) AD BDE', cor161: 'HQ 617 (I) AD BDE', cor1111: '22 ARTY BDE',
// };

// const commandNames = {
//   ec: 'Eastern Command',
//   wc: 'Western Command',
//   sc: 'Southern Command',
//   nc: 'Northern Command',
//   swc: 'South Western Command',
//   anc: 'Central Command',
// };

// const unitNames = [
//   '65 FIELD REGIMENT', '66 FIELD REGIMENT', '67 FIELD REGIMENT',
//   '68 FIELD REGIMENT', '69 FIELD REGIMENT', '70 ARTILLERY UNIT',
//   '71 ARTILLERY UNIT', '72 INFANTRY UNIT', '73 INFANTRY UNIT',
//   '74 CAVALRY UNIT', '75 CAVALRY UNIT', '76 SIGNAL UNIT'
// ];

// const operatorCategories = [
//   { code: 'a', name: 'Army' },
//   { code: 'af', name: 'Air Force' },
//   { code: 'n', name: 'Navy' }
// ];

// // Realistic drone specifications based on real data
// const droneSpecs = {
//   'MQ-9 Reaper': {
//     maxHeight: 15240.00,
//     maxSpeed: 444.00,
//     maxRange: 1900.00,
//     maxDuration: 1620,
//     gpsEnabled: 'yes',
//     autonomous: 'yes',
//     controlled: 'yes',
//     cameraEnabled: 'yes',
//     cameraResolution: '4K',
//     operatingFrequency: '5.8 GHz'
//   },
//   'DJI Mavic 3': {
//     maxHeight: 6000.00,
//     maxSpeed: 75.60,
//     maxRange: 15.00,
//     maxDuration: 46,
//     gpsEnabled: 'yes',
//     autonomous: 'yes',
//     controlled: 'yes',
//     cameraEnabled: 'yes',
//     cameraResolution: '5.1K',
//     operatingFrequency: '2.4-5.8 GHz'
//   },
//   'Parrot Anafi': {
//     maxHeight: 4500.00,
//     maxSpeed: 54.00,
//     maxRange: 4.00,
//     maxDuration: 32,
//     gpsEnabled: 'yes',
//     autonomous: 'yes',
//     controlled: 'yes',
//     cameraEnabled: 'yes',
//     cameraResolution: '4K HDR',
//     operatingFrequency: '2.4/5 GHz'
//   },
//   'Autel Evo II': {
//     maxHeight: 8000.00,
//     maxSpeed: 72.00,
//     maxRange: 9.00,
//     maxDuration: 40,
//     gpsEnabled: 'yes',
//     autonomous: 'yes',
//     controlled: 'yes',
//     cameraEnabled: 'yes',
//     cameraResolution: '8K',
//     operatingFrequency: '2.4/5.8 GHz'
//   },
//   'Skydio 2': {
//     maxHeight: 4572.00,
//     maxSpeed: 58.00,
//     maxRange: 6.00,
//     maxDuration: 27,
//     gpsEnabled: 'yes',
//     autonomous: 'yes',
//     controlled: 'yes',
//     cameraEnabled: 'yes',
//     cameraResolution: '4K60 HDR',
//     operatingFrequency: '2.4/5 GHz'
//   }
// };

// const droneModels = Object.keys(droneSpecs);
// const droneClasses = ['SMALL', 'MEDIUM', 'LARGE'];
// const purposes = ['Recon Alpha', 'Surveillance Beta', 'Patrol Gamma', 'Training Delta', 'Inspection Epsilon'];
// const gpsOptions = ['yes']; // All have GPS
// const yesNoOptions = ['yes']; // All yes for autonomous/controlled/camera

// async function initializeDatabase() {
//   const connection = await mysql.createConnection({
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD
//   });

//   try {
//     console.log('Creating database if not exists...');
//     await connection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
//     console.log('Database created successfully');
    
//     await connection.end();
//     await createTables();
//     await seedInitialData();
//     console.log('Database initialization completed successfully');
//   } catch (error) {
//     console.error('Database initialization failed:', error);
//     throw error;
//   }
// }

// async function createTables() {
//   const pool = mysql.createPool(dbConfig);
//   const connection = await pool.getConnection();
  
//   try {
//     console.log('Creating tables...');

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
//         assigned_command VARCHAR(10),
//         can_access_all_commands BOOLEAN DEFAULT FALSE,
//         is_active BOOLEAN DEFAULT TRUE,
//         createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//       )
//     `);

//     await connection.execute(`
//       CREATE TABLE IF NOT EXISTS command_permissions (
//         id VARCHAR(36) PRIMARY KEY,
//         user_id VARCHAR(36) NOT NULL,
//         command_code VARCHAR(10) NOT NULL,
//         permission_type ENUM('read', 'write', 'delete', 'admin') NOT NULL DEFAULT 'read',
//         granted_by VARCHAR(36),
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
//         FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
//         UNIQUE KEY unique_user_command_permission (user_id, command_code, permission_type)
//       )
//     `);

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
//         command_code VARCHAR(10),
//         createdAt TIMESTAMP NOT NULL,
//         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
//       )
//     `);

//     await connection.execute(`
//       CREATE TABLE IF NOT EXISTS drone_ids (
//         id VARCHAR(36) PRIMARY KEY,
//         drone_spec_id VARCHAR(36) NOT NULL,
//         drone_id VARCHAR(255) NOT NULL,
//         FOREIGN KEY (drone_spec_id) REFERENCES drone_specs(id) ON DELETE CASCADE
//       )
//     `);

//     await connection.execute(`
//       CREATE TABLE IF NOT EXISTS flights (
//         id VARCHAR(36) PRIMARY KEY,
//         user_id VARCHAR(36) NOT NULL,
//         drone_model VARCHAR(255) NOT NULL,
//         drone_class VARCHAR(255) NOT NULL,
//         command_name VARCHAR(255) NOT NULL DEFAULT '',
//         command_code VARCHAR(10),
//         frequency DECIMAL(10,3) NOT NULL,
//         clockDrift DECIMAL(10,3) NOT NULL DEFAULT 0,
//         spectralLeakage DECIMAL(10,3) NOT NULL DEFAULT 0,
//         modularshapeId INT NOT NULL DEFAULT 0,
//         purpose TEXT NOT NULL,
//         start DATETIME NOT NULL,
//         end DATETIME NOT NULL,
//         status ENUM('planned', 'active', 'completed') NOT NULL DEFAULT 'planned',
//         cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
//         approved_by VARCHAR(36),
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
//         FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
//       )
//     `);

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

//     console.log('All tables created successfully');
//   } finally {
//     connection.release();
//     await pool.end();
//   }
// }

// async function seedInitialData() {
//   const pool = mysql.createPool(dbConfig);
//   const connection = await pool.getConnection();
  
//   try {
//     await connection.beginTransaction();
//     console.log('Seeding initial data...');

//     // Insert command hierarchy
//     const commands = [
//       { code: 'ec', name: 'Eastern Command', fullName: 'EASTERN COMMAND', location: 'Kolkata', lat: 22.5726, lng: 88.3639 },
//       { code: 'wc', name: 'Western Command', fullName: 'WESTERN COMMAND', location: 'Chandimandir', lat: 30.7333, lng: 76.7794 },
//       { code: 'sc', name: 'Southern Command', fullName: 'SOUTHERN COMMAND', location: 'Pune', lat: 18.5204, lng: 73.8567 },
//       { code: 'nc', name: 'Northern Command', fullName: 'NORTHERN COMMAND', location: 'Udhampur', lat: 32.9266, lng: 75.1378 },
//       { code: 'swc', name: 'South Western Command', fullName: 'SOUTH WESTERN COMMAND', location: 'Jaipur', lat: 26.9124, lng: 75.7873 },
//       { code: 'anc', name: 'Central Command', fullName: 'CENTRAL COMMAND', location: 'Lucknow', lat: 26.8467, lng: 80.9462 }
//     ];

//     for (const cmd of commands) {
//       await connection.execute(`
//         INSERT INTO command_hierarchy (id, command_code, command_name, command_full_name, headquarters_location, latitude, longitude)
//         VALUES (UUID(), ?, ?, ?, ?, ?, ?)
//         ON DUPLICATE KEY UPDATE
//         command_name = VALUES(command_name),
//         command_full_name = VALUES(command_full_name),
//         headquarters_location = VALUES(headquarters_location),
//         latitude = VALUES(latitude),
//         longitude = VALUES(longitude)
//       `, [cmd.code, cmd.name, cmd.fullName, cmd.location, cmd.lat, cmd.lng]);
//     }

//     console.log('Command hierarchy data inserted');

//     // Create super admin
//     const superAdminId = uuidv4();
//     const superAdminPwd = await bcrypt.hash('admin123', 10);
    
//     await connection.execute(`
//       INSERT INTO users (
//         id, username, password, role, command_number,
//         operatorCategory, operatorCategoryName, command, commandName,
//         division, divisionName, brigade, brigadeName,
//         corps, corpsName, unit, assigned_command, can_access_all_commands, createdAt
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//     `, [
//       superAdminId, 'admin', superAdminPwd, 'SUPER_ADMIN', 1,
//       'sa', 'Super Admin', '', '',
//       '', '', '', '',
//       '', '', 'SYSTEM ADMIN', null, true
//     ]);

//     console.log('Super admin user created');

//     // Create command admins
//     const commandAdmins = [
//       { code: 'ec', name: 'Eastern Command', username: 'ecadmin', password: '123456' },
//       { code: 'wc', name: 'Western Command', username: 'wcadmin', password: '123456' },
//       { code: 'sc', name: 'Southern Command', username: 'scadmin', password: '123456' },
//       { code: 'nc', name: 'Northern Command', username: 'ncadmin', password: '123456' },
//       { code: 'swc', name: 'South Western Command', username: 'swcadmin', password: '123456' },
//       { code: 'anc', name: 'Central Command', username: 'ccadmin', password: '123456' }
//     ];

//     for (let i = 0; i < commandAdmins.length; i++) {
//       const admin = commandAdmins[i];
//       const adminId = uuidv4();
//       const adminPwd = await bcrypt.hash(admin.password, 10);
      
//       await connection.execute(`
//         INSERT INTO users (
//           id, username, password, role, command_number,
//           operatorCategory, operatorCategoryName, command, commandName,
//           division, divisionName, brigade, brigadeName,
//           corps, corpsName, unit, assigned_command, can_access_all_commands, createdAt
//         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//       `, [
//         adminId, admin.username, adminPwd, 'COMMAND_ADMIN', i + 2,
//         'ca', 'Command Admin', admin.code, admin.name,
//         '', '', '', '',
//         '', '', `${admin.name} HQ`, admin.code, false
//       ]);
//     }

//     console.log('Command admins created');

//     // Generate operators distributed across hierarchy
//     let totalUsers = 0;
//     let commandCounter = 10;

//     // Loop through each command
//     for (const [cmdCode, cmdData] of Object.entries(hierarchyData)) {
//       console.log(`\nProcessing command: ${commandNames[cmdCode]}`);
      
//       // Loop through each division
//       for (const [divCode, divData] of Object.entries(cmdData.divisions)) {
//         console.log(`  Division: ${divData.name}`);
        
//         // Loop through each brigade
//         for (const [bdeCode, bdeData] of Object.entries(divData.brigades)) {
//           if (!bdeData.name) continue; // Skip empty brigades
          
//           console.log(`    Brigade: ${bdeData.name}`);
          
//           // If brigade has corps, create users in each corps
//           if (bdeData.corps && bdeData.corps.length > 0) {
//             for (const corpsCode of bdeData.corps) {
//               const corpsName = corpsNames[corpsCode] || 'Unknown Corps';
              
//               // Create 10-15 users per corps
//               const usersInCorps = faker.number.int({ min: 10, max: 15 });
              
//               for (let u = 0; u < usersInCorps; u++) {
//                 const userId = uuidv4();
//                 const username = `${cmdCode}_${divCode}_${bdeCode}_${corpsCode}_${u + 1}`;
//                 const userPwd = await bcrypt.hash('operator123', 10);
//                 const category = faker.helpers.arrayElement(operatorCategories);
//                 const unit = faker.helpers.arrayElement(unitNames);

//                 await connection.execute(`
//                   INSERT INTO users (
//                     id, username, password, role, command_number,
//                     operatorCategory, operatorCategoryName, command, commandName,
//                     division, divisionName, brigade, brigadeName,
//                     corps, corpsName, unit, createdAt
//                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//                 `, [
//                   userId, username, userPwd, 'OPERATOR', commandCounter++,
//                   category.code, category.name, cmdCode, commandNames[cmdCode],
//                   divCode, divData.name, bdeCode, bdeData.name,
//                   corpsCode, corpsName, unit
//                 ]);

//                 totalUsers++;

//                 // Add 1-3 drone specs per operator (randomly)
//                 const numDrones = faker.number.int({ min: 1, max: 3 });
//                 for (let d = 0; d < numDrones; d++) {
//                   const droneSpecId = uuidv4();
//                   const droneName = faker.helpers.arrayElement(droneModels);
//                   const spec = droneSpecs[droneName];
//                   const quantity = faker.number.int({ min: 1, max: 5 });
//                   const frequency = 2400.000; // Representative for 2.4 GHz band
//                   const clockDrift = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//                   const spectralLeakage = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//                   const modularshapeId = faker.number.int({ min: 0, max: 5 });

//                   await connection.execute(`
//                     INSERT INTO drone_specs (
//                       id, user_id, droneName, quantity, frequency, clockDrift, spectralLeakage,
//                       modularshapeId, maxHeight, maxSpeed, maxRange, maxDuration,
//                       gpsEnabled, autonomous, controlled, cameraEnabled, cameraResolution,
//                       operatingFrequency, command_code, createdAt
//                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//                   `, [
//                     droneSpecId, userId, droneName, quantity, frequency, clockDrift, spectralLeakage,
//                     modularshapeId, spec.maxHeight, spec.maxSpeed, spec.maxRange, spec.maxDuration,
//                     spec.gpsEnabled, spec.autonomous, spec.controlled, spec.cameraEnabled, spec.cameraResolution,
//                     spec.operatingFrequency, cmdCode
//                   ]);

//                   // Add 1-3 drone IDs per spec
//                   const numDroneIds = faker.number.int({ min: 1, max: 3 });
//                   for (let idIndex = 0; idIndex < numDroneIds; idIndex++) {
//                     const droneIdEntry = uuidv4();
//                     const droneId = `DR-${faker.number.int({ min: 100, max: 999 })}-${droneName.replace(/\s/g, '')}`;

//                     await connection.execute(
//                       'INSERT INTO drone_ids (id, drone_spec_id, drone_id) VALUES (?, ?, ?)',
//                       [droneIdEntry, droneSpecId, droneId]
//                     );
//                   }
//                 }

//                 // Add 2-4 flights per operator
//                 const numFlights = faker.number.int({ min: 2, max: 4 });
//                 for (let f = 0; f < numFlights; f++) {
//                   const flightId = uuidv4();
//                   const droneModel = faker.helpers.arrayElement(droneModels);
//                   const spec = droneSpecs[droneModel];
//                   const droneClass = faker.helpers.arrayElement(droneClasses);
//                   const frequency = 2400.000; // Representative for 2.4 GHz band
//                   const clockDrift = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//                   const spectralLeakage = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//                   const modularshapeId = faker.number.int({ min: 0, max: 5 });
//                   const purpose = faker.helpers.arrayElement(purposes);
//                   const start = faker.date.future();
//                   const end = new Date(start.getTime() + faker.number.int({ min: 3600000, max: 86400000 }));
//                   const status = faker.helpers.arrayElement(['planned', 'active', 'completed']);
//                   const cancelRequested = faker.datatype.boolean();

//                   await connection.execute(`
//                     INSERT INTO flights (
//                       id, user_id, drone_model, drone_class, command_name, command_code, frequency,
//                       clockDrift, spectralLeakage, modularshapeId, purpose, start, end, status,
//                       cancel_requested, created_at
//                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//                   `, [
//                     flightId, userId, droneModel, droneClass, commandNames[cmdCode], cmdCode,
//                     frequency, clockDrift, spectralLeakage, modularshapeId, purpose,
//                     start, end, status, cancelRequested
//                   ]);

//                   // Add 3-8 waypoints per flight
//                   const numWaypoints = faker.number.int({ min: 3, max: 8 });
//                   for (let w = 0; w < numWaypoints; w++) {
//                     const lat = faker.location.latitude();
//                     const lng = faker.location.longitude();
//                     const elev = faker.number.int({ min: 500, max: 5000 });
//                     const sequence = w + 1;

//                     await connection.execute(
//                       'INSERT INTO waypoints (flight_id, lat, lng, elev, sequence) VALUES (?, ?, ?, ?, ?)',
//                       [flightId, lat, lng, elev, sequence]
//                     );
//                   }
//                 }
//               }
//               console.log(`      Corps ${corpsName}: Created ${usersInCorps} users`);
//             }
//           } else {
//             // Brigade has no corps, create users directly in brigade
//             const usersInBrigade = faker.number.int({ min: 10, max: 15 });
            
//             for (let u = 0; u < usersInBrigade; u++) {
//               const userId = uuidv4();
//               const username = `${cmdCode}_${divCode}_${bdeCode}_${u + 1}`;
//               const userPwd = await bcrypt.hash('operator123', 10);
//               const category = faker.helpers.arrayElement(operatorCategories);
//               const unit = faker.helpers.arrayElement(unitNames);

//               await connection.execute(`
//                 INSERT INTO users (
//                   id, username, password, role, command_number,
//                   operatorCategory, operatorCategoryName, command, commandName,
//                   division, divisionName, brigade, brigadeName,
//                   corps, corpsName, unit, createdAt
//                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//               `, [
//                 userId, username, userPwd, 'OPERATOR', commandCounter++,
//                 category.code, category.name, cmdCode, commandNames[cmdCode],
//                 divCode, divData.name, bdeCode, bdeData.name,
//                 '', '', unit
//               ]);

//               totalUsers++;

//               // Add 1-3 drone specs per operator
//               const numDrones = faker.number.int({ min: 1, max: 3 });
//               for (let d = 0; d < numDrones; d++) {
//                 const droneSpecId = uuidv4();
//                 const droneName = faker.helpers.arrayElement(droneModels);
//                 const spec = droneSpecs[droneName];
//                 const quantity = faker.number.int({ min: 1, max: 5 });
//                 const frequency = 2400.000; // Representative for 2.4 GHz band
//                 const clockDrift = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//                 const spectralLeakage = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//                 const modularshapeId = faker.number.int({ min: 0, max: 5 });

//                 await connection.execute(`
//                   INSERT INTO drone_specs (
//                     id, user_id, droneName, quantity, frequency, clockDrift, spectralLeakage,
//                     modularshapeId, maxHeight, maxSpeed, maxRange, maxDuration,
//                     gpsEnabled, autonomous, controlled, cameraEnabled, cameraResolution,
//                     operatingFrequency, command_code, createdAt
//                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//                 `, [
//                   droneSpecId, userId, droneName, quantity, frequency, clockDrift, spectralLeakage,
//                   modularshapeId, spec.maxHeight, spec.maxSpeed, spec.maxRange, spec.maxDuration,
//                   spec.gpsEnabled, spec.autonomous, spec.controlled, spec.cameraEnabled, spec.cameraResolution,
//                   spec.operatingFrequency, cmdCode
//                 ]);

//                 // Add 1-3 drone IDs per spec
//                 const numDroneIds = faker.number.int({ min: 1, max: 3 });
//                 for (let idIndex = 0; idIndex < numDroneIds; idIndex++) {
//                   const droneIdEntry = uuidv4();
//                   const droneId = `DR-${faker.number.int({ min: 100, max: 999 })}-${droneName.replace(/\s/g, '')}`;

//                   await connection.execute(
//                     'INSERT INTO drone_ids (id, drone_spec_id, drone_id) VALUES (?, ?, ?)',
//                     [droneIdEntry, droneSpecId, droneId]
//                   );
//                 }
//               }

//               // Add 2-4 flights per operator
//               const numFlights = faker.number.int({ min: 2, max: 4 });
//               for (let f = 0; f < numFlights; f++) {
//                 const flightId = uuidv4();
//                 const droneModel = faker.helpers.arrayElement(droneModels);
//                 const spec = droneSpecs[droneModel];
//                 const droneClass = faker.helpers.arrayElement(droneClasses);
//                 const frequency = 2400.000; // Representative for 2.4 GHz band
//                 const clockDrift = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//                 const spectralLeakage = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//                 const modularshapeId = faker.number.int({ min: 0, max: 5 });
//                 const purpose = faker.helpers.arrayElement(purposes);
//                 const start = faker.date.future();
//                 const end = new Date(start.getTime() + faker.number.int({ min: 3600000, max: 86400000 }));
//                 const status = faker.helpers.arrayElement(['planned', 'active', 'completed']);
//                 const cancelRequested = faker.datatype.boolean();

//                 await connection.execute(`
//                   INSERT INTO flights (
//                     id, user_id, drone_model, drone_class, command_name, command_code, frequency,
//                     clockDrift, spectralLeakage, modularshapeId, purpose, start, end, status,
//                     cancel_requested, created_at
//                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//                 `, [
//                   flightId, userId, droneModel, droneClass, commandNames[cmdCode], cmdCode,
//                   frequency, clockDrift, spectralLeakage, modularshapeId, purpose,
//                   start, end, status, cancelRequested
//                 ]);

//                 // Add 3-8 waypoints per flight
//                 const numWaypoints = faker.number.int({ min: 3, max: 8 });
//                 for (let w = 0; w < numWaypoints; w++) {
//                   const lat = faker.location.latitude();
//                   const lng = faker.location.longitude();
//                   const elev = faker.number.int({ min: 500, max: 5000 });
//                   const sequence = w + 1;

//                   await connection.execute(
//                     'INSERT INTO waypoints (flight_id, lat, lng, elev, sequence) VALUES (?, ?, ?, ?, ?)',
//                     [flightId, lat, lng, elev, sequence]
//                   );
//                 }
//               }
//             }
//             console.log(`      Brigade ${bdeData.name}: Created ${usersInBrigade} users (no corps)`);
//           }
//         }
//       }
//     }

//     await connection.commit();
//     console.log(`\n✅ Initial data seeded successfully!`);
//     console.log(`\n📊 Summary:`);
//     console.log(`   Total Operators Created: ${totalUsers}`);
//     console.log(`   Distribution: 10-15 users per Corps/Brigade`);
//     console.log(`   Drones per Operator: 1-3 (random, with realistic specs)`);
//     console.log(`   Flights per Operator: 2-4`);

//   } catch (error) {
//     await connection.rollback();
//     console.error('Failed to seed data:', error);
//     throw error;
//   } finally {
//     connection.release();
//     await pool.end();
//   }
// }

// async function main() {
//   try {
//     console.log('Starting RBAC database setup...\n');
//     await initializeDatabase();
//     console.log('\n=== RBAC Database Setup Complete ===');
//     console.log('\nDEFAULT CREDENTIALS:');
//     console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
//     console.log('\n🔑 Super Admin:');
//     console.log('   Username: admin');
//     console.log('   Password: admin123');
//     console.log('\n🔑 Command Admins:');
//     console.log('   EC Admin - Username: ecadmin  - Password: 123456');
//     console.log('   WC Admin - Username: wcadmin  - Password: 123456');
//     console.log('   SC Admin - Username: scadmin  - Password: 123456');
//     console.log('   NC Admin - Username: ncadmin  - Password: 123456');
//     console.log('   SWC Admin - Username: swcadmin - Password: 123456');
//     console.log('   Central Admin - Username: ccadmin  - Password: 123456');
//     console.log('\n🔑 Operators:');
//     console.log('   All operators - Password: operator123');
//     console.log('   Username format: <cmd>_<div>_<bde>_<corps>_<number>');
//     console.log('   Example: ec_ar_bde1_cor36_1');
//     console.log('\n✨ Setup completed successfully!');
//     console.log('You can now start your backend server.');
//     process.exit(0);
//   } catch (error) {
//     console.error('Setup failed:', error);
//     process.exit(1);
//   }
// }

// if (require.main === module) {
//   main();
// }

// module.exports = {
//   initializeDatabase,
//   createTables,
//   seedInitialData
// }





// const mysql = require('mysql2/promise');
// const bcrypt = require('bcryptjs');
// const { v4: uuidv4 } = require('uuid');
// const { faker } = require('@faker-js/faker');
// require('dotenv').config();

// const dbConfig = {
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   waitForConnections: true,
//   connectionLimit: 20, // Increased for better parallelism
//   queueLimit: 0
// };

// // Hierarchy data from your interfaces
// const hierarchyData = {
//   sc: {
//     divisions: {
//       ar: {
//         name: 'HQ 12 CORPS',
//         brigades: {
//           bde1: { name: 'HQ JOSA', corps: [] },
//           bde2: { name: '11 RAPID', corps: ['cor4', 'cor5', 'cor6', 'cor7', 'cor8'] },
//           bde3: { name: '12 RAPID', corps: ['cor9', 'cor10', 'cor11', 'cor12', 'cor13', 'cor14', 'cor15', 'cor16', 'cor17', 'cor18'] },
//         },
//       },
//       cr: {
//         name: 'HQ 21 CORPS',
//         brigades: {
//           bde1: { name: '31 ARMD DIV', corps: ['cor21', 'cor22', 'cor23', 'cor24'] },
//           bde2: { name: '36 RAPID', corps: ['cor25', 'cor26', 'cor27', 'cor28'] },
//           bde3: { name: '41 ARTY DIV', corps: ['cor29', 'cor30', 'cor31'] },
//           bde4: { name: '54 INF DIV', corps: ['cor32', 'cor33', 'cor34', 'cor35', 'cor159', 'cor160', 'cor161'] },
//         },
//       },
//     },
//   },
//   ec: {
//     divisions: {
//       ar: {
//         name: '3 CORPS',
//         brigades: {
//           bde1: { name: '2 MNT DIV', corps: ['cor36', 'cor37', 'cor38', 'cor39'] },
//           bde2: { name: '56 INF DIV', corps: ['cor40', 'cor41', 'cor42', 'cor43'] },
//           bde3: { name: '57 MNT DIV', corps: ['cor44', 'cor45', 'cor46', 'cor47'] },
//         },
//       },
//       br: {
//         name: '4 CORPS',
//         brigades: {
//           bde1: { name: '5 MNT DIV', corps: ['cor48', 'cor49', 'cor50', 'cor51', 'cor52'] },
//           bde2: { name: '21 MTN DIV', corps: [] },
//           bde3: { name: '71 INF DIV', corps: ['cor53', 'cor54', 'cor55', 'cor56', 'cor57'] },
//         },
//       },
//       cr: {
//         name: '33 CORPS',
//         brigades: {
//           bde1: { name: '17 MTN DIV', corps: ['cor58', 'cor59', 'cor60', 'cor61', 'cor62'] },
//           bde2: { name: '20 MTN DIV', corps: ['cor63', 'cor64', 'cor65', 'cor66'] },
//           bde3: { name: '27 MTN DIV', corps: [] },
//           bde4: { name: 'HQ 111 SUB AREA', corps: [] },
//         },
//       },
//       dr: {
//         name: '17 CORPS',
//         brigades: {
//           bde1: { name: '59 INF DIV', corps: ['cor67', 'cor68', 'cor69', 'cor70'] },
//           bde2: { name: '23 INF DIV', corps: ['cor71', 'cor72', 'cor73', 'cor74', 'cor75', 'cor76'] },
//         },
//       },
//     },
//   },
//   wc: {
//     divisions: {
//       ar: {
//         name: 'HQ 2 CORPS',
//         brigades: {
//           bde1: { name: 'HQ 1 ARMD DIV', corps: [] },
//           bde2: { name: 'HQ 9 INF DIV ', corps: ['cor77', 'cor78', 'cor79', 'cor80'] },
//           bde3: { name: 'HQ 22 RAPID DIV(S)', corps: ['cor81', 'cor82', 'cor83', 'cor84', 'cor1111'] },
//           bde4: { name: 'HQ 40 ARTY DIV', corps: ['cor85', 'cor86', 'cor87'] },
//         },
//       },
//       br: {
//         name: 'HQ 9 CORPS',
//         brigades: {
//           bde1: { name: '26 INF DIV', corps: ['cor88', 'cor89', 'cor90', 'cor91', 'cor92'] },
//           bde2: { name: '29 INF DIV ', corps: ['cor93', 'cor94', 'cor95', 'cor96', 'cor97'] },
//         },
//       },
//       cr: {
//         name: 'HQ 11 CORPS',
//         brigades: {
//           bde1: { name: '7 INF DIV ', corps: ['cor99', 'cor100', 'cor101', 'cor102', 'cor103'] },
//           bde2: { name: '15 INF DIV', corps: [] },
//         },
//       },
//     },
//   },
//   nc: {
//     divisions: {
//       ar: {
//         name: '1 CORPS',
//         brigades: {
//           bde1: { name: '4 INF DI', corps: ['cor104', 'cor105', 'cor106', 'cor107'] },
//           bde2: { name: '6 INF DIV', corps: ['cor108', 'cor109', 'cor110', 'cor111'] },
//           bde3: { name: '42 ARTY DIV', corps: ['cor112', 'cor113', 'cor114'] },
//         },
//       },
//       br: {
//         name: '14 CORPS',
//         brigades: {
//           bde1: { name: '3 INF DIV ', corps: ['cor115', 'cor116', 'cor117'] },
//           bde2: { name: '8 MTN DIV', corps: ['cor118', 'cor119', 'cor120', 'cor121'] },
//           bde3: { name: 'UNIFORM FORCE', corps: ['cor122'] },
//         },
//       },
//       cr: {
//         name: '15 CORPS',
//         brigades: {
//           bde1: { name: '19 INF DIV', corps: ['cor123', 'cor124', 'cor125', 'cor126', 'cor127'] },
//           bde2: { name: '26 INF DIV', corps: ['cor128', 'cor129', 'cor130', 'cor131', 'cor132', 'cor133'] },
//         },
//       },
//       dr: {
//         name: '16 CORPS',
//         brigades: {
//           bde1: { name: '10 RAPID', corps: ['cor134', 'cor135', 'cor136', 'cor137', 'cor138'] },
//           bde2: { name: '25 INF DIV', corps: ['cor139', 'cor140', 'cor141', 'cor142', 'cor143'] },
//         },
//       },
//     },
//   },
//   swc: {
//     divisions: {
//       ar: {
//         name: '10 CORPS',
//         brigades: {
//           bde1: { name: '16 RAPID', corps: ['cor144', 'cor145', 'cor146', 'cor147', 'cor148'] },
//           bde2: { name: '18 INF DIV', corps: ['cor149', 'cor150', 'cor151', 'cor152', 'cor153'] },
//           bde3: { name: '24 RAPID', corps: ['cor154', 'cor155', 'cor156', 'cor157', 'cor158'] },
//         },
//       },
//     },
//   },
//   anc: {
//     divisions: {
//       ar: {
//         name: 'HQ 14 INF DIV ',
//         brigades: {
//           bde1: { name: '14 ARTY BDE', corps: [] },
//           bde2: { name: '71 MTN BDE', corps: [] },
//           bde3: { name: '95 INF BDE', corps: [] },
//           bde4: { name: '116 INF BDE', corps: [] },
//         },
//       },
//     },
//   },
// };

// const corpsNames = {
//   cor4: '85 INF BDE', cor5: '31 INF BDE', cor6: '110 ARMD BDE', cor7: '330 INF BDE',
//   cor8: '11 ARTY BDE', cor9: '12 ARTY BDE', cor10: '20 INF BDE', cor11: '30 INF BDE',
//   cor12: '45 INF BDE', cor13: '140 ARMD BDE', cor14: '4(I) ARMD BDE', cor15: '75 (I) INF BDE',
//   cor16: '340 (I) BDE', cor17: '769 (I) MECH BDE', cor18: '12 CAB', cor21: '27 ARMD BDE',
//   cor22: '34 ARMD BDE', cor23: '94 ARMD BDE', cor24: '31 ARTY BDE', cor25: '18 ARMD BDE',
//   cor26: '72 INF BDE', cor27: '115 INF BDE', cor28: '36 ARTY BDE', cor29: '97 ARTY BDE',
//   cor30: '98 ARTY BDE', cor31: '374 COMP ARTY BDE', cor32: '47 INF BDE', cor33: '54 ARTY BDE',
//   cor34: '76 INF BDE', cor35: '91 INF BDE', cor36: '2 ARTY BDE', cor37: '82 MTN BDE',
//   cor38: '117 MTN BDE', cor39: '181 MTN BDE', cor40: '5 INF BDE', cor41: '22 INF BDE',
//   cor42: '56 ARTY BDE', cor43: '103 INF BDE', cor44: '44 MTN BDE', cor45: '57 MTN ARTY BDE',
//   cor46: '59 MTN BDE', cor47: '73 MTN BDE', cor48: '311 MTN BDE', cor49: '351 INF BDE',
//   cor50: '77 MTN BDE', cor51: '5 MTN ARTY BDE', cor52: '190 MTN BDE', cor53: '40 MTN BDE',
//   cor54: '46 INF BDE', cor55: '106 INF BDE', cor56: '71 ARTY BDE', cor57: '604(I) AVN BDE',
//   cor58: '63 MTN BDE', cor59: '64 MTN BDE', cor60: '164 MTN BDE', cor61: '166 MTN BDE',
//   cor62: '17 MTN ARTY BDE', cor63: '20 MTN ARTY BDE', cor64: '66 MTN BDE', cor65: '165 MTN BDE',
//   cor66: '202 MTN BDE', cor67: '59 ARTY BDE', cor68: '122 INF BDE', cor69: '124 INF BDE',
//   cor70: '131 INF BDE', cor71: '61 INF BDE', cor72: '167 INF BDE', cor73: '23 ARTY BDE',
//   cor74: '417 ENGNR BDE', cor75: '17 CORPS ARTY BDE', cor76: '788(I) AD BDE', cor77: '9 ARTY BDE',
//   cor78: '32 INF BDE', cor79: '38 INF BDE', cor80: '42 INF BDE', cor81: '35 INF BDE',
//   cor82: '49 INF BDE', cor83: '60 INF BDE', cor84: '58 ARMD BDE', cor85: '261 ARTY BDE',
//   cor86: '371 CAB', cor87: '372 ARTY BDE', cor88: '26 ARTY BDE', cor89: '19 INF BDE',
//   cor90: '162 INF BDE', cor91: '92 INF BDE', cor92: '36 INF BDE', cor93: '168 INF BDE',
//   cor94: '29 ARTY BDE', cor95: '51 INF BDE', cor96: '78 INF BDE', cor97: '19 INF BDE',
//   cor99: 'SARVATRA BDE', cor100: 'AGNIVAAN BDE', cor101: '37 INF BDE', cor102: 'SEHJRA BDE',
//   cor103: 'BAKRI BDE', cor104: '4 ARTY BDE', cor105: '7 INF BDE', cor106: '41 INF BDE',
//   cor107: '146 INF BDE', cor108: '6 MTN BDE', cor109: '69 MTN BDE', cor110: '99 MTN BDE',
//   cor111: '135 IND BDE', cor112: '72 ARTY BDE', cor113: '99 ARTY BDE', cor114: '373 ARTY BDE',
//   cor115: '81 INF BDE', cor116: '4 SECTOR', cor117: '3 ARTY BDE', cor118: '56 MTN BDE',
//   cor119: '121 (I) INF BDE GP', cor120: '192 MTN BDE', cor121: '8 MTN BDE', cor122: '15 SECT RR',
//   cor123: '17 INF BDE', cor124: '12 INF BDE', cor125: '161 INF BDE', cor126: '19 ARTY BDE',
//   cor127: '79 MTN BDE', cor128: '104 INF BDE', cor129: '268 INF BDE', cor130: '53 INF BDE',
//   cor131: '109 INF BDE', cor132: '68 MTN BDE', cor133: '28 ARTY BDE', cor134: '10 ARTY BDE',
//   cor135: '28 INF BDE', cor136: '52 INF BDE ', cor137: '191 INF BDE', cor138: '130 ARMD BDE',
//   cor139: '93 INF BDE', cor140: '10 INF BDE', cor141: '120 INF BDE', cor142: '80 INF BDE',
//   cor143: '25 ARTY BDE', cor144: '15 INF BDE', cor145: '67 INF BDE', cor146: '89 INF BDE',
//   cor147: '16 ARTY BDE', cor148: '62 ARMD BDE', cor149: '18 ARTY BDE', cor150: '74 INF BDE',
//   cor151: '150 ARMD BDE', cor152: '322 INF BDE', cor153: '83 INF BDE', cor154: '8 INF BDE',
//   cor155: '24 ARTY BDE', cor156: '25 INF BDE', cor157: '170 INF BDE', cor158: '180 ARMD BDE',
//   cor159: '475 ENGR BDE', cor160: '787 (I) AD BDE', cor161: 'HQ 617 (I) AD BDE', cor1111: '22 ARTY BDE',
// };

// const commandNames = {
//   ec: 'Eastern Command',
//   wc: 'Western Command',
//   sc: 'Southern Command',
//   nc: 'Northern Command',
//   swc: 'South Western Command',
//   anc: 'Central Command',
// };

// const unitNames = [
//   '65 FIELD REGIMENT', '66 FIELD REGIMENT', '67 FIELD REGIMENT',
//   '68 FIELD REGIMENT', '69 FIELD REGIMENT', '70 ARTILLERY UNIT',
//   '71 ARTILLERY UNIT', '72 INFANTRY UNIT', '73 INFANTRY UNIT',
//   '74 CAVALRY UNIT', '75 CAVALRY UNIT', '76 SIGNAL UNIT'
// ];

// const operatorCategories = [
//   { code: 'a', name: 'Army' },
//   { code: 'af', name: 'Air Force' },
//   { code: 'n', name: 'Navy' }
// ];

// // Realistic drone specifications based on real data
// const droneSpecs = {
//   'MQ-9 Reaper': {
//     maxHeight: 15240.00,
//     maxSpeed: 444.00,
//     maxRange: 1900.00,
//     maxDuration: 1620,
//     gpsEnabled: 'yes',
//     autonomous: 'yes',
//     controlled: 'yes',
//     cameraEnabled: 'yes',
//     cameraResolution: '4K',
//     operatingFrequency: '5.8 GHz'
//   },
//   'DJI Mavic 3': {
//     maxHeight: 6000.00,
//     maxSpeed: 75.60,
//     maxRange: 15.00,
//     maxDuration: 46,
//     gpsEnabled: 'yes',
//     autonomous: 'yes',
//     controlled: 'yes',
//     cameraEnabled: 'yes',
//     cameraResolution: '5.1K',
//     operatingFrequency: '2.4-5.8 GHz'
//   },
//   'Parrot Anafi': {
//     maxHeight: 4500.00,
//     maxSpeed: 54.00,
//     maxRange: 4.00,
//     maxDuration: 32,
//     gpsEnabled: 'yes',
//     autonomous: 'yes',
//     controlled: 'yes',
//     cameraEnabled: 'yes',
//     cameraResolution: '4K HDR',
//     operatingFrequency: '2.4/5 GHz'
//   },
//   'Autel Evo II': {
//     maxHeight: 8000.00,
//     maxSpeed: 72.00,
//     maxRange: 9.00,
//     maxDuration: 40,
//     gpsEnabled: 'yes',
//     autonomous: 'yes',
//     controlled: 'yes',
//     cameraEnabled: 'yes',
//     cameraResolution: '8K',
//     operatingFrequency: '2.4/5.8 GHz'
//   },
//   'Skydio 2': {
//     maxHeight: 4572.00,
//     maxSpeed: 58.00,
//     maxRange: 6.00,
//     maxDuration: 27,
//     gpsEnabled: 'yes',
//     autonomous: 'yes',
//     controlled: 'yes',
//     cameraEnabled: 'yes',
//     cameraResolution: '4K60 HDR',
//     operatingFrequency: '2.4/5 GHz'
//   }
// };

// const droneModels = Object.keys(droneSpecs);
// const droneClasses = ['SMALL', 'MEDIUM', 'LARGE'];
// const purposes = ['Recon Alpha', 'Surveillance Beta', 'Patrol Gamma', 'Training Delta', 'Inspection Epsilon'];
// const gpsOptions = ['yes']; // All have GPS
// const yesNoOptions = ['yes']; // All yes for autonomous/controlled/camera

// async function initializeDatabase() {
//   const connection = await mysql.createConnection({
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD
//   });

//   try {
//     console.log('Creating database if not exists...');
//     await connection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
//     console.log('Database created successfully');
    
//     await connection.end();
//     await createTables();
//     await seedInitialData();
//     console.log('Database initialization completed successfully');
//   } catch (error) {
//     console.error('Database initialization failed:', error);
//     throw error;
//   }
// }

// async function createTables() {
//   const pool = mysql.createPool(dbConfig);
//   const connection = await pool.getConnection();
  
//   try {
//     console.log('Creating tables...');

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
//         assigned_command VARCHAR(10),
//         can_access_all_commands BOOLEAN DEFAULT FALSE,
//         is_active BOOLEAN DEFAULT TRUE,
//         createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//       )
//     `);

//     await connection.execute(`
//       CREATE TABLE IF NOT EXISTS command_permissions (
//         id VARCHAR(36) PRIMARY KEY,
//         user_id VARCHAR(36) NOT NULL,
//         command_code VARCHAR(10) NOT NULL,
//         permission_type ENUM('read', 'write', 'delete', 'admin') NOT NULL DEFAULT 'read',
//         granted_by VARCHAR(36),
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
//         FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
//         UNIQUE KEY unique_user_command_permission (user_id, command_code, permission_type)
//       )
//     `);

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
//         command_code VARCHAR(10),
//         createdAt TIMESTAMP NOT NULL,
//         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
//       )
//     `);

//     await connection.execute(`
//       CREATE TABLE IF NOT EXISTS drone_ids (
//         id VARCHAR(36) PRIMARY KEY,
//         drone_spec_id VARCHAR(36) NOT NULL,
//         drone_id VARCHAR(255) NOT NULL,
//         FOREIGN KEY (drone_spec_id) REFERENCES drone_specs(id) ON DELETE CASCADE
//       )
//     `);

//     await connection.execute(`
//       CREATE TABLE IF NOT EXISTS flights (
//         id VARCHAR(36) PRIMARY KEY,
//         user_id VARCHAR(36) NOT NULL,
//         drone_model VARCHAR(255) NOT NULL,
//         drone_class VARCHAR(255) NOT NULL,
//         command_name VARCHAR(255) NOT NULL DEFAULT '',
//         command_code VARCHAR(10),
//         frequency DECIMAL(10,3) NOT NULL,
//         clockDrift DECIMAL(10,3) NOT NULL DEFAULT 0,
//         spectralLeakage DECIMAL(10,3) NOT NULL DEFAULT 0,
//         modularshapeId INT NOT NULL DEFAULT 0,
//         purpose TEXT NOT NULL,
//         start DATETIME NOT NULL,
//         end DATETIME NOT NULL,
//         status ENUM('planned', 'active', 'completed') NOT NULL DEFAULT 'planned',
//         cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
//         approved_by VARCHAR(36),
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
//         FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
//       )
//     `);

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

//     console.log('All tables created successfully');
//   } finally {
//     connection.release();
//     await pool.end();
//   }
// }

// async function seedInitialData() {
//   const pool = mysql.createPool(dbConfig);
//   const connection = await pool.getConnection();
  
//   try {
//     await connection.beginTransaction();
//     console.log('Seeding initial data...');

//     // Pre-hash passwords once for speed
//     const operatorPwd = await bcrypt.hash('operator123', 10);
//     const adminPwd = await bcrypt.hash('123456', 10);
//     const superAdminPwd = await bcrypt.hash('admin123', 10);

//     // Insert command hierarchy
//     const commands = [
//       { code: 'ec', name: 'Eastern Command', fullName: 'EASTERN COMMAND', location: 'Kolkata', lat: 22.5726, lng: 88.3639 },
//       { code: 'wc', name: 'Western Command', fullName: 'WESTERN COMMAND', location: 'Chandimandir', lat: 30.7333, lng: 76.7794 },
//       { code: 'sc', name: 'Southern Command', fullName: 'SOUTHERN COMMAND', location: 'Pune', lat: 18.5204, lng: 73.8567 },
//       { code: 'nc', name: 'Northern Command', fullName: 'NORTHERN COMMAND', location: 'Udhampur', lat: 32.9266, lng: 75.1378 },
//       { code: 'swc', name: 'South Western Command', fullName: 'SOUTH WESTERN COMMAND', location: 'Jaipur', lat: 26.9124, lng: 75.7873 },
//       { code: 'anc', name: 'Central Command', fullName: 'CENTRAL COMMAND', location: 'Lucknow', lat: 26.8467, lng: 80.9462 }
//     ];

//     for (const cmd of commands) {
//       await connection.execute(`
//         INSERT INTO command_hierarchy (id, command_code, command_name, command_full_name, headquarters_location, latitude, longitude)
//         VALUES (UUID(), ?, ?, ?, ?, ?, ?)
//         ON DUPLICATE KEY UPDATE
//         command_name = VALUES(command_name),
//         command_full_name = VALUES(command_full_name),
//         headquarters_location = VALUES(headquarters_location),
//         latitude = VALUES(latitude),
//         longitude = VALUES(longitude)
//       `, [cmd.code, cmd.name, cmd.fullName, cmd.location, cmd.lat, cmd.lng]);
//     }

//     console.log('Command hierarchy data inserted');

//     // Create super admin
//     const superAdminId = uuidv4();
    
//     await connection.execute(`
//       INSERT INTO users (
//         id, username, password, role, command_number,
//         operatorCategory, operatorCategoryName, command, commandName,
//         division, divisionName, brigade, brigadeName,
//         corps, corpsName, unit, assigned_command, can_access_all_commands, createdAt
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//     `, [
//       superAdminId, 'admin', superAdminPwd, 'SUPER_ADMIN', 1,
//       'sa', 'Super Admin', '', '',
//       '', '', '', '',
//       '', '', 'SYSTEM ADMIN', null, true
//     ]);

//     console.log('Super admin user created');

//     // Create command admins
//     const commandAdmins = [
//       { code: 'ec', name: 'Eastern Command', username: 'ecadmin' },
//       { code: 'wc', name: 'Western Command', username: 'wcadmin' },
//       { code: 'sc', name: 'Southern Command', username: 'scadmin' },
//       { code: 'nc', name: 'Northern Command', username: 'ncadmin' },
//       { code: 'swc', name: 'South Western Command', username: 'swcadmin' },
//       { code: 'anc', name: 'Central Command', username: 'ccadmin' }
//     ];

//     for (let i = 0; i < commandAdmins.length; i++) {
//       const admin = commandAdmins[i];
//       const adminId = uuidv4();
      
//       await connection.execute(`
//         INSERT INTO users (
//           id, username, password, role, command_number,
//           operatorCategory, operatorCategoryName, command, commandName,
//           division, divisionName, brigade, brigadeName,
//           corps, corpsName, unit, assigned_command, can_access_all_commands, createdAt
//         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//       `, [
//         adminId, admin.username, adminPwd, 'COMMAND_ADMIN', i + 2,
//         'ca', 'Command Admin', admin.code, admin.name,
//         '', '', '', '',
//         '', '', `${admin.name} HQ`, admin.code, false
//       ]);
//     }

//     console.log('Command admins created');

//     // Generate operators distributed across hierarchy - scaled to 50k-60k total operators and ~80k drone specs
//     let totalUsers = 0;
//     let totalDrones = 0;
//     let commandCounter = 10;
//     const maxOperators = faker.number.int({ min: 50000, max: 60000 });
//     const maxDrones = 80000; // Scaled proportionally

//     console.log(`Target: ${maxOperators} operators, ${maxDrones} drones`);

//     // Loop through each command
//     for (const [cmdCode, cmdData] of Object.entries(hierarchyData)) {
//       console.log(`\nProcessing command: ${commandNames[cmdCode]}`);
      
//       // Loop through each division
//       for (const [divCode, divData] of Object.entries(cmdData.divisions)) {
//         console.log(`  Division: ${divData.name}`);
        
//         // Loop through each brigade
//         for (const [bdeCode, bdeData] of Object.entries(divData.brigades)) {
//           if (!bdeData.name) continue; // Skip empty brigades
          
//           console.log(`    Brigade: ${bdeData.name}`);
          
//           // If brigade has corps, create users in each corps
//           if (bdeData.corps && bdeData.corps.length > 0) {
//             for (const corpsCode of bdeData.corps) {
//               const corpsName = corpsNames[corpsCode] || 'Unknown Corps';
              
//               // Scale users per corps to reach total 50k-60k
//               const remainingUsers = maxOperators - totalUsers;
//               if (remainingUsers <= 0) break;
              
//               const usersInCorps = Math.min(faker.number.int({ min: 100, max: 200 }), remainingUsers);
              
//               for (let u = 0; u < usersInCorps; u++) {
//                 const userId = uuidv4();
//                 const username = `${cmdCode}_${divCode}_${bdeCode}_${corpsCode}_${u + 1}`;
//                 const category = faker.helpers.arrayElement(operatorCategories);
//                 const unit = faker.helpers.arrayElement(unitNames);

//                 await connection.execute(`
//                   INSERT INTO users (
//                     id, username, password, role, command_number,
//                     operatorCategory, operatorCategoryName, command, commandName,
//                     division, divisionName, brigade, brigadeName,
//                     corps, corpsName, unit, createdAt
//                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//                 `, [
//                   userId, username, operatorPwd, 'OPERATOR', commandCounter++,
//                   category.code, category.name, cmdCode, commandNames[cmdCode],
//                   divCode, divData.name, bdeCode, bdeData.name,
//                   corpsCode, corpsName, unit
//                 ]);

//                 totalUsers++;

//                 // Add 1-2 drone specs per operator, limited to total ~80k
//                 const remainingDrones = maxDrones - totalDrones;
//                 if (remainingDrones > 0) {
//                   const numDrones = Math.min(faker.number.int({ min: 1, max: 2 }), remainingDrones);
//                   for (let d = 0; d < numDrones; d++) {
//                     const droneSpecId = uuidv4();
//                     const droneName = faker.helpers.arrayElement(droneModels);
//                     const spec = droneSpecs[droneName];
//                     const quantity = faker.number.int({ min: 1, max: 5 });
//                     const frequency = 2400.000; // Representative for 2.4 GHz band
//                     const clockDrift = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//                     const spectralLeakage = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//                     const modularshapeId = faker.number.int({ min: 0, max: 5 });

//                     await connection.execute(`
//                       INSERT INTO drone_specs (
//                         id, user_id, droneName, quantity, frequency, clockDrift, spectralLeakage,
//                         modularshapeId, maxHeight, maxSpeed, maxRange, maxDuration,
//                         gpsEnabled, autonomous, controlled, cameraEnabled, cameraResolution,
//                         operatingFrequency, command_code, createdAt
//                       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//                     `, [
//                       droneSpecId, userId, droneName, quantity, frequency, clockDrift, spectralLeakage,
//                       modularshapeId, spec.maxHeight, spec.maxSpeed, spec.maxRange, spec.maxDuration,
//                       spec.gpsEnabled, spec.autonomous, spec.controlled, spec.cameraEnabled, spec.cameraResolution,
//                       spec.operatingFrequency, cmdCode
//                     ]);

//                     totalDrones++;

//                     // Add 1 drone ID per spec (reduced for speed)
//                     const droneIdEntry = uuidv4();
//                     const droneId = `DR-${faker.number.int({ min: 100, max: 999 })}-${droneName.replace(/\s/g, '')}`;

//                     await connection.execute(
//                       'INSERT INTO drone_ids (id, drone_spec_id, drone_id) VALUES (?, ?, ?)',
//                       [droneIdEntry, droneSpecId, droneId]
//                     );
//                   }
//                 }

//                 // Add 1 flight per operator (minimized for speed)
//                 const flightId = uuidv4();
//                 const droneModel = faker.helpers.arrayElement(droneModels);
//                 const spec = droneSpecs[droneModel];
//                 const droneClass = faker.helpers.arrayElement(droneClasses);
//                 const frequency = 2400.000; // Representative for 2.4 GHz band
//                 const clockDrift = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//                 const spectralLeakage = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//                 const modularshapeId = faker.number.int({ min: 0, max: 5 });
//                 const purpose = faker.helpers.arrayElement(purposes);
//                 const start = faker.date.future();
//                 const end = new Date(start.getTime() + faker.number.int({ min: 3600000, max: 86400000 }));
//                 const status = faker.helpers.arrayElement(['planned', 'active', 'completed']);
//                 const cancelRequested = faker.datatype.boolean();

//                 await connection.execute(`
//                   INSERT INTO flights (
//                     id, user_id, drone_model, drone_class, command_name, command_code, frequency,
//                     clockDrift, spectralLeakage, modularshapeId, purpose, start, end, status,
//                     cancel_requested, created_at
//                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//                 `, [
//                   flightId, userId, droneModel, droneClass, commandNames[cmdCode], cmdCode,
//                   frequency, clockDrift, spectralLeakage, modularshapeId, purpose,
//                   start, end, status, cancelRequested
//                 ]);

//                 // Add 3 fixed waypoints per flight (minimized for speed)
//                 for (let w = 0; w < 3; w++) {
//                   const lat = faker.location.latitude();
//                   const lng = faker.location.longitude();
//                   const elev = faker.number.int({ min: 500, max: 5000 });
//                   const sequence = w + 1;

//                   await connection.execute(
//                     'INSERT INTO waypoints (flight_id, lat, lng, elev, sequence) VALUES (?, ?, ?, ?, ?)',
//                     [flightId, lat, lng, elev, sequence]
//                   );
//                 }

//                 if (totalUsers >= maxOperators) break;
//               }
//               console.log(`      Corps ${corpsName}: Created ${usersInCorps} users (Total users: ${totalUsers})`);
//               if (totalUsers >= maxOperators) break;
//             }
//             if (totalUsers >= maxOperators) break;
//           } else {
//             // Brigade has no corps, create users directly in brigade
//             const remainingUsers = maxOperators - totalUsers;
//             if (remainingUsers <= 0) break;
            
//             const usersInBrigade = Math.min(faker.number.int({ min: 100, max: 200 }), remainingUsers);
            
//             for (let u = 0; u < usersInBrigade; u++) {
//               const userId = uuidv4();
//               const username = `${cmdCode}_${divCode}_${bdeCode}_${u + 1}`;
//               const category = faker.helpers.arrayElement(operatorCategories);
//               const unit = faker.helpers.arrayElement(unitNames);

//               await connection.execute(`
//                 INSERT INTO users (
//                   id, username, password, role, command_number,
//                   operatorCategory, operatorCategoryName, command, commandName,
//                   division, divisionName, brigade, brigadeName,
//                   corps, corpsName, unit, createdAt
//                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//               `, [
//                 userId, username, operatorPwd, 'OPERATOR', commandCounter++,
//                 category.code, category.name, cmdCode, commandNames[cmdCode],
//                 divCode, divData.name, bdeCode, bdeData.name,
//                 '', '', unit
//               ]);

//               totalUsers++;

//               // Add 1-2 drone specs per operator, limited to total ~80k
//               const remainingDrones = maxDrones - totalDrones;
//               if (remainingDrones > 0) {
//                 const numDrones = Math.min(faker.number.int({ min: 1, max: 2 }), remainingDrones);
//                 for (let d = 0; d < numDrones; d++) {
//                   const droneSpecId = uuidv4();
//                   const droneName = faker.helpers.arrayElement(droneModels);
//                   const spec = droneSpecs[droneName];
//                   const quantity = faker.number.int({ min: 1, max: 5 });
//                   const frequency = 2400.000; // Representative for 2.4 GHz band
//                   const clockDrift = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//                   const spectralLeakage = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//                   const modularshapeId = faker.number.int({ min: 0, max: 5 });

//                   await connection.execute(`
//                     INSERT INTO drone_specs (
//                       id, user_id, droneName, quantity, frequency, clockDrift, spectralLeakage,
//                       modularshapeId, maxHeight, maxSpeed, maxRange, maxDuration,
//                       gpsEnabled, autonomous, controlled, cameraEnabled, cameraResolution,
//                       operatingFrequency, command_code, createdAt
//                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//                   `, [
//                     droneSpecId, userId, droneName, quantity, frequency, clockDrift, spectralLeakage,
//                     modularshapeId, spec.maxHeight, spec.maxSpeed, spec.maxRange, spec.maxDuration,
//                     spec.gpsEnabled, spec.autonomous, spec.controlled, spec.cameraEnabled, spec.cameraResolution,
//                     spec.operatingFrequency, cmdCode
//                   ]);

//                   totalDrones++;

//                   // Add 1 drone ID per spec (reduced for speed)
//                   const droneIdEntry = uuidv4();
//                   const droneId = `DR-${faker.number.int({ min: 100, max: 999 })}-${droneName.replace(/\s/g, '')}`;

//                   await connection.execute(
//                     'INSERT INTO drone_ids (id, drone_spec_id, drone_id) VALUES (?, ?, ?)',
//                     [droneIdEntry, droneSpecId, droneId]
//                   );
//                 }
//               }

//               // Add 1 flight per operator (minimized for speed)
//               const flightId = uuidv4();
//               const droneModel = faker.helpers.arrayElement(droneModels);
//               const spec = droneSpecs[droneModel];
//               const droneClass = faker.helpers.arrayElement(droneClasses);
//               const frequency = 2400.000; // Representative for 2.4 GHz band
//               const clockDrift = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//               const spectralLeakage = faker.number.float({ min: 0, max: 1, fractionDigits: 3 });
//               const modularshapeId = faker.number.int({ min: 0, max: 5 });
//               const purpose = faker.helpers.arrayElement(purposes);
//               const start = faker.date.future();
//               const end = new Date(start.getTime() + faker.number.int({ min: 3600000, max: 86400000 }));
//               const status = faker.helpers.arrayElement(['planned', 'active', 'completed']);
//               const cancelRequested = faker.datatype.boolean();

//               await connection.execute(`
//                 INSERT INTO flights (
//                   id, user_id, drone_model, drone_class, command_name, command_code, frequency,
//                   clockDrift, spectralLeakage, modularshapeId, purpose, start, end, status,
//                   cancel_requested, created_at
//                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//               `, [
//                 flightId, userId, droneModel, droneClass, commandNames[cmdCode], cmdCode,
//                 frequency, clockDrift, spectralLeakage, modularshapeId, purpose,
//                 start, end, status, cancelRequested
//               ]);

//               // Add 3 fixed waypoints per flight (minimized for speed)
//               for (let w = 0; w < 3; w++) {
//                 const lat = faker.location.latitude();
//                 const lng = faker.location.longitude();
//                 const elev = faker.number.int({ min: 500, max: 5000 });
//                 const sequence = w + 1;

//                 await connection.execute(
//                   'INSERT INTO waypoints (flight_id, lat, lng, elev, sequence) VALUES (?, ?, ?, ?, ?)',
//                   [flightId, lat, lng, elev, sequence]
//                 );
//               }

//               if (totalUsers >= maxOperators) break;
//             }
//             console.log(`      Brigade ${bdeData.name}: Created ${usersInBrigade} users (no corps) (Total users: ${totalUsers})`);
//             if (totalUsers >= maxOperators) break;
//           }
//           if (totalUsers >= maxOperators) break;
//         }
//         if (totalUsers >= maxOperators) break;
//       }
//       if (totalUsers >= maxOperators) break;
//     }

//     await connection.commit();
//     console.log(`\n✅ Initial data seeded successfully!`);
//     console.log(`\n📊 Summary:`);
//     console.log(`   Total Operators Created: ${totalUsers} (target: ${maxOperators})`);
//     console.log(`   Total Drone Specs Created: ${totalDrones} (target: ${maxDrones})`);
//     console.log(`   Distribution: 100-200 users per Corps/Brigade`);
//     console.log(`   Drones per Operator: 1-2 (random, with realistic specs)`);
//     console.log(`   Flights per Operator: 1 (optimized for speed)`);

//   } catch (error) {
//     await connection.rollback();
//     console.error('Failed to seed data:', error);
//     throw error;
//   } finally {
//     connection.release();
//     await pool.end();
//   }
// }

// async function main() {
//   console.time('Total Setup Time');
//   try {
//     console.log('Starting RBAC database setup...\n');
//     await initializeDatabase();
//     console.log('\n=== RBAC Database Setup Complete ===');
//     console.log('\nDEFAULT CREDENTIALS:');
//     console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
//     console.log('\n🔑 Super Admin:');
//     console.log('   Username: admin');
//     console.log('   Password: admin123');
//     console.log('\n🔑 Command Admins:');
//     console.log('   EC Admin - Username: ecadmin  - Password: 123456');
//     console.log('   WC Admin - Username: wcadmin  - Password: 123456');
//     console.log('   SC Admin - Username: scadmin  - Password: 123456');
//     console.log('   NC Admin - Username: ncadmin  - Password: 123456');
//     console.log('   SWC Admin - Username: swcadmin - Password: 123456');
//     console.log('   Central Admin - Username: ccadmin  - Password: 123456');
//     console.log('\n🔑 Operators:');
//     console.log('   All operators - Password: operator123');
//     console.log('   Username format: <cmd>_<div>_<bde>_<corps>_<number>');
//     console.log('   Example: ec_ar_bde1_cor36_1');
//     console.log('\n✨ Setup completed successfully!');
//     console.log('You can now start your backend server.');
//     console.timeEnd('Total Setup Time');
//     process.exit(0);
//   } catch (error) {
//     console.error('Setup failed:', error);
//     process.exit(1);
//   }
// }

// if (require.main === module) {
//   main();
// }

// module.exports = {
//   initializeDatabase,
//   createTables,
//   seedInitialData
// }