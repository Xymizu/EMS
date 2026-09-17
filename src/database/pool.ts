import mysql, { type Pool } from 'mysql2/promise';

import { getDatabaseConfig } from '../config/database.js';

let applicationPool: Pool | undefined;

export function getApplicationPool(): Pool {
  applicationPool ??= mysql.createPool({
    ...getDatabaseConfig(),
    connectionLimit: 10,
    queueLimit: 100,
    connectTimeout: 10_000,
    enableKeepAlive: true,
  });
  return applicationPool;
}

export async function closeApplicationPool(): Promise<void> {
  if (!applicationPool) return;
  const pool = applicationPool;
  applicationPool = undefined;
  await pool.end();
}
