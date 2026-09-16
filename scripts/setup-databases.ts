import mysql from 'mysql2/promise';

import { getDatabaseName, getServerConfig } from '../src/config/database.js';

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

const connection = await mysql.createConnection(getServerConfig());

try {
  for (const database of [developmentDatabase, testDatabase]) {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${quoteDatabaseName(database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  }
  console.log(`Databases ready: ${developmentDatabase}, ${testDatabase}`);
} finally {
  await connection.end();
}
