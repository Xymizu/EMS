import mysql from 'mysql2/promise';

import {
  getAdminServerConfig,
  getDatabaseName,
  getServerConfig,
} from '../src/config/database.js';

function quoteDatabaseName(name: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`Unsafe database name: ${name}`);
  }
  return `\`${name}\``;
}

const developmentDatabase = getDatabaseName();
const testDatabase = getDatabaseName(true);

if (developmentDatabase === testDatabase) {
  throw new Error('DB_NAME and TEST_DB_NAME must refer to different databases');
}

const adminConfig = getAdminServerConfig();
const applicationConfig = getServerConfig();
const connection = await mysql.createConnection(adminConfig);

try {
  const applicationUser = String(applicationConfig.user);
  const adminUser = String(adminConfig.user);
  const applicationPassword = String(applicationConfig.password ?? '');
  const applicationAccount = `${connection.escape(applicationUser)}@'%'`;

  if (applicationUser !== adminUser) {
    await connection.query(
      `CREATE USER IF NOT EXISTS ${applicationAccount} IDENTIFIED BY ${connection.escape(applicationPassword)}`,
    );
    await connection.query(
      `ALTER USER ${applicationAccount} IDENTIFIED BY ${connection.escape(applicationPassword)}`,
    );
  }
  for (const database of [developmentDatabase, testDatabase]) {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${quoteDatabaseName(database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    if (applicationUser !== adminUser) {
      await connection.query(
        `GRANT ALL PRIVILEGES ON ${quoteDatabaseName(database)}.* TO ${applicationAccount}`,
      );
    }
  }
  console.log(`Databases ready: ${developmentDatabase}, ${testDatabase}`);
} finally {
  await connection.end();
}
