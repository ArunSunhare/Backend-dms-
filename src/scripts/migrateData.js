// const { pool, initializeDatabase } = require('../config/database');
// const bcrypt = require('bcryptjs');
// const { v4: uuidv4 } = require('uuid');

// async function seedInitialData() {
//   const connection = await pool.getConnection();
  
//   try {
//     await connection.beginTransaction();
    
//     // Check if data already exists
//     const [existingUsers] = await connection.execute('SELECT COUNT(*) as count FROM users');
//     if (existingUsers[0].count > 0) {
//       console.log('Data already exists, skipping seed');
//       return;
//     }

//     // Create initial users
//     const adminId = uuidv4();
//     const controllerId = uuidv4();
//     const userId = uuidv4();
    
//     const adminPwd = await bcrypt.hash('admin123', 10);
//     //const controllerPwd = await bcrypt.hash('controller123', 10);
//     const userPwd = await bcrypt.hash('user123', 10);

//     // Admin user
//     await connection.execute(`
//       INSERT INTO users (
//         id, username, password, role, command_number,
//         operatorCategory, operatorCategoryName, command, commandName,
//         division, divisionName, brigade, brigadeName,
//         corps, corpsName, unit, createdAt
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//     `, [
//       adminId, 'admin', adminPwd, 'ADMINISTRATOR', 1,
//       'a', 'Army', 'ec', 'Eastern Command',
//       'ar', 'HQ 3 CORPS', 'bde1', 'HQ 2 MNT DIV',
//       'cor36', '2 ARTY BDE', 'HQ ADMIN UNIT'
//     ]);

//     // Controller user
//     await connection.execute(`
//       INSERT INTO users (
//         id, username, password, role, command_number,
//         operatorCategory, operatorCategoryName, command, commandName,
//         division, divisionName, brigade, brigadeName,
//         corps, corpsName, unit, createdAt
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//     `, [
     
//     ]);

//     // Default operator user
//     await connection.execute(`
//       INSERT INTO users (
//         id, username, password, role, command_number,
//         operatorCategory, operatorCategoryName, command, commandName,
//         division, divisionName, brigade, brigadeName,
//         corps, corpsName, unit, createdAt
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//     `, [
//       userId, '67GR', userPwd, 'OPERATOR', 3,
//       'a', 'Army', 'sc', 'Southern Command',
//       'ar', 'HQ 12 CORPS', 'bde2', '11 RAPID',
//       'cor5', '31 INF BDE', '67 FIELD REGIMENT'
//     ]);

//     // Add sample drone spec
//     const droneSpecId = uuidv4();
//     await connection.execute(`
//       INSERT INTO drone_specs (
//         id, user_id, droneName, quantity, frequency, clockDrift, spectralLeakage,
//         modularshapeId, maxHeight, maxSpeed, maxRange, maxDuration,
//         gpsEnabled, autonomous, controlled, cameraEnabled, cameraResolution,
//         operatingFrequency, createdAt
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//     `, [
//       droneSpecId, userId, 'MQ-9 Reaper', 1, 1090.0, 0.1, 0.2, 1,
//       15000, 50, 100, 120, 'yes', 'yes', 'yes', 'yes',
//       '4K', '2.4 GHz to 5.8 GHz'
//     ]);

//     // Add drone ID
//     const droneIdEntry = uuidv4();
//     await connection.execute(
//       'INSERT INTO drone_ids (id, drone_spec_id, drone_id) VALUES (?, ?, ?)',
//       [droneIdEntry, droneSpecId, 'DR-001-MQ9']
//     );

//     // Add sample flight - FIXED: Removed one placeholder since NOW() is used for start
//     const flightId = uuidv4();
//     const later = new Date(Date.now() + 2 * 60 * 60 * 1000);

//     await connection.execute(`
//       INSERT INTO flights (
//         id, user_id, drone_model, drone_class, command_name, frequency,
//         clockDrift, spectralLeakage, modularshapeId, purpose, start, end, status
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)
//     `, [
//       flightId, userId, 'MQ-9 Reaper', 'MEDIUM', 'SOUTHERN COMMAND',
//       1090.0, 0.1, 0.2, 1, 'Recon Alpha', later, 'active'
//     ]);

//     // Add sample waypoints
//     const waypoints = [
//       { lat: 28.6139, lng: 77.2090, elev: 1000 },
//       { lat: 28.7041, lng: 77.1025, elev: 1200 },
//       { lat: 28.5355, lng: 77.3910, elev: 1100 }
//     ];

//     for (let i = 0; i < waypoints.length; i++) {
//       const wp = waypoints[i];
//       await connection.execute(
//         'INSERT INTO waypoints (flight_id, lat, lng, elev, sequence) VALUES (?, ?, ?, ?, ?)',
//         [flightId, wp.lat, wp.lng, wp.elev, i + 1]
//       );
//     }

//     await connection.commit();
//     console.log('Initial data seeded successfully');

//   } catch (error) {
//     await connection.rollback();
//     console.error('Failed to seed data:', error);
//     throw error;
//   } finally {
//     connection.release();
//   }
// }

// // Run migration
// async function runMigration() {
//   try {
//     await initializeDatabase();
//     await seedInitialData();
//     console.log('Migration completed successfully');
//     process.exit(0);
//   } catch (error) {
//     console.error('Migration failed:', error);
//     process.exit(1);
//   }
// }

// if (require.main === module) {
//   runMigration();
// }

// module.exports = { seedInitialData };