// seed-railway-fast.js   ← Save this file in your backend root
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

(async () => {
  console.log('Connecting to Railway MySQL...');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  // ──────────────────────────────────────
  // 1. Create Super Admin (working login)
  // ──────────────────────────────────────
  const superAdminPass = await bcrypt.hash('admin123', 10);
  await connection.execute(`
    INSERT INTO users (id, username, password, role, createdAt, updatedAt)
    VALUES ('super-001', 'admin', ?, 'SUPER_ADMIN', NOW(), NOW())
    ON DUPLICATE KEY UPDATE password = VALUES(password)
  `, [superAdminPass]);

  // ──────────────────────────────────────
  // 2. Create a few Command Admins
  // ──────────────────────────────────────
  const cmdPass = await bcrypt.hash('123456', 10);
  const commands = ['ec', 'wc', 'sc', 'nc', 'swc', 'anc'];
  for (const cmd of commands) {
    await connection.execute(`
      INSERT INTO users (id, username, password, role, command, commandName, createdAt)
      VALUES (?, ?, ?, 'COMMAND_ADMIN', ?, ?, NOW())
      ON DUPLICATE KEY UPDATE password = VALUES(password)
    `, [`cmd-${cmd}`, `${cmd}admin`, cmdPass, cmd.toUpperCase(), `${cmd.toUpperCase()} COMMAND`]);
  }

  // ──────────────────────────────────────
  // 3. Create 500 realistic operators + drones + flights (fast & safe)
  // ──────────────────────────────────────
  const operatorPass = await bcrypt.hash('operator123', 10);
  const droneModels = ['DJI Mavic 3', 'Autel Evo II', 'MQ-9 Reaper', 'Parrot Anafi'];

  for (let i = 1; i <= 500; i++) {
    const cmd = commands[i % commands.length];
    const userId = `user-${i.toString().padStart(5, '0')}`;

    await connection.execute(`
      INSERT INTO users (id, username, password, role, command, unit, createdAt)
      VALUES (?, ?, ?, 'OPERATOR', ?, 'Demo Unit', NOW())
    `, [userId, `operator${i}`, operatorPass, cmd.toUpperCase()]);

    // One drone spec per user
    const droneSpecId = `spec-${i}`;
    const model = droneModels[i % droneModels.length];
    await connection.execute(`
      INSERT INTO drone_specs (id, user_id, droneName, quantity, maxHeight, maxSpeed, maxRange, maxDuration,
        gpsEnabled, autonomous, controlled, cameraEnabled, cameraResolution, operatingFrequency, command_code, createdAt)
      VALUES (?, ?, ?, 3, 6000, 75, 15, 46, 'yes', 'yes', 'yes', 'yes', '4K', '2.4-5.8 GHz', ?, NOW())
    `, [droneSpecId, userId, model, cmd]);

    // One flight per user
    const flightId = `flight-${i}`;
    await connection.execute(`
      INSERT INTO flights (id, user_id, drone_model, drone_class, command_code, purpose, start, end, status, created_at)
      VALUES (?, ?, ?, 'MEDIUM', ?, 'Demo Mission', NOW(), DATE_ADD(NOW(), INTERVAL 2 HOUR), 'planned', NOW())
    `, [flightId, userId, model, cmd]);
  }

  console.log('Done! 500 operators + drones + flights added');
  console.log('Login now with:');
  console.log('→ Super Admin:  admin / admin123');
  console.log('→ Command Admin: ecadmin / 123456  (same for wcadmin, ncadmin, etc.)');
  console.log('→ Operators: operator1 to operator500 / operator123');

  await connection.end();
})();