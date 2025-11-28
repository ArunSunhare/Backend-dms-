const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const connection = await mysql.createConnection({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE
  });

  const [tables] = await connection.query("SHOW TABLES");

  for (const row of tables) {
    const table = Object.values(row)[0];
    console.log(`Dropping table: ${table}`);
    await connection.query(`DROP TABLE IF EXISTS \`${table}\``);
  }

  console.log("All tables dropped.");
  await connection.end();
})();
