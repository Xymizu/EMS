import mysql, { type Pool } from 'mysql2/promise';

import { getDatabaseConfig } from '../config/database.js';

let applicationPool: Pool | undefined;

export function getApplicationPool(): Pool {
  applicationPool ??= mysql.createPool({
    ...getDatabaseConfig(),
    connectionLimit: 10,
    queueLimit: 0,
  });
  return applicationPool;
}
