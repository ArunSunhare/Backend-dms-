// src/scripts/setupRBAC.js  (NOW: DROPS ALL TABLES)
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

async function dropAllTables() {
  if (!process.env.DB_NAME) {
    throw new Error('DB_NAME is not set in environment variables');
  }

  console.log('Connecting to database to drop all tables...');
  const connection = await mysql.createConnection(dbConfig);

  try {
    console.log(`Connected to DB: ${process.env.DB_NAME}`);

    // Get all tables in the current database
    const [rows] = await connection.query(
      `
      SELECT TABLE_NAME 
      FROM information_schema.tables
      WHERE table_schema = ?
      `,
      [process.env.DB_NAME]
    );

    if (!rows.length) {
      console.log('No tables found in database. Nothing to drop.');
      return;
    }

    console.log('Tables found:');
    rows.forEach((row) => console.log(`- ${row.TABLE_NAME}`));

    console.log('\nDisabling foreign key checks...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    console.log('Dropping tables...');
    for (const row of rows) {
      const tableName = row.TABLE_NAME;
      console.log(`Dropping table: ${tableName}`);
      await connection.query(`DROP TABLE IF EXISTS \`${tableName}\``);
    }

    console.log('Re-enabling foreign key checks...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('\n✅ All tables dropped successfully from database:', process.env.DB_NAME);
  } catch (error) {
    console.error('❌ Failed to drop tables:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Main runner
async function main() {
  try {
    console.log('=== WARNING ===');
    console.log('This script will DELETE ALL TABLES in your database:', process.env.DB_NAME);
    console.log('Starting drop process...\n');

    await dropAllTables();

    console.log('\n=== DONE ===');
    console.log('All tables are now deleted. You can now run your migration/seed script again if needed.');
    process.exit(0);
  } catch (error) {
    console.error('\nScript failed:', error);
    process.exit(1);
  }
}

// Run only if executed directly: `node src/scripts/setupRBAC.js`
if (require.main === module) {
  main();
}

module.exports = {
  dropAllTables,
};
