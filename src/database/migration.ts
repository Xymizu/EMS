import { readFile } from 'node:fs/promises';

import mysql from 'mysql2/promise';

import { getDatabaseConfig } from '../config/database.js';

const migrationFiles = {
  up: new URL('../../database/migrations/001_initial_schema.up.sql', import.meta.url),
  down: new URL('../../database/migrations/001_initial_schema.down.sql', import.meta.url),
} as const;

export async function executeMigration(
  direction: keyof typeof migrationFiles,
  useTestDatabase = false,
): Promise<void> {
  const sql = await readFile(migrationFiles[direction], 'utf8');
  const connection = await mysql.createConnection({
    ...getDatabaseConfig(useTestDatabase),
    multipleStatements: true,
  });

  try {
    await connection.query(sql);
  } finally {
    await connection.end();
  }
}
