import assert from 'node:assert/strict';
import test from 'node:test';

import mysql, {
  type Connection,
  type ResultSetHeader,
  type RowDataPacket,
} from 'mysql2/promise';

import {
  getDatabaseConfig,
  getDatabaseName,
} from '../src/config/database.js';
import { executeMigration } from '../src/database/migration.js';

interface ColumnRow extends RowDataPacket {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  COLUMN_TYPE: string;
  IS_NULLABLE: 'YES' | 'NO';
  COLUMN_DEFAULT: string | null;
  EXTRA: string;
}

interface CountRow extends RowDataPacket {
  count: string;
}

interface TaskRow extends RowDataPacket {
  assigned_employee_id: string | null;
  status: string;
}

interface MySqlError extends Error {
  code?: string;
}

const developmentDatabase = getDatabaseName();
const testDatabase = getDatabaseName(true);

if (developmentDatabase === testDatabase) {
  throw new Error('Refusing to test: TEST_DB_NAME must differ from DB_NAME');
}

function hasMySqlCode(error: unknown, expectedCodes: readonly string[]): boolean {
  return (
    error instanceof Error &&
    expectedCodes.includes((error as MySqlError).code ?? '')
  );
}

async function expectMySqlError(
  operation: () => Promise<unknown>,
  ...expectedCodes: string[]
): Promise<void> {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(
      hasMySqlCode(error, expectedCodes),
      `Expected ${expectedCodes.join(' or ')}, received ${String((error as MySqlError).code)}`,
    );
    return true;
  });
}

async function clearData(connection: Connection): Promise<void> {
  await connection.query('DELETE FROM tasks');
  await connection.query('DELETE FROM project_members');
  await connection.query('DELETE FROM projects');
  await connection.query('DELETE FROM employees');
  await connection.query('DELETE FROM users');
}

async function insertUser(connection: Connection, suffix: string): Promise<number> {
  const [result] = await connection.execute<ResultSetHeader>(
    'INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)',
    [`User ${suffix}`, `${suffix}@example.com`, '$2b$12$test.hash.value'],
  );
  return result.insertId;
}

async function insertEmployee(
  connection: Connection,
  suffix: string,
  role = 'STAFF',
): Promise<number> {
  const userId = await insertUser(connection, suffix);
  const [result] = await connection.execute<ResultSetHeader>(
    'INSERT INTO employees (user_id, role, tanggal_masuk) VALUES (?, ?, ?)',
    [userId, role, '2026-01-15'],
  );
  return result.insertId;
}

async function insertProject(
  connection: Connection,
  leadEmployeeId: number,
): Promise<number> {
  const [result] = await connection.execute<ResultSetHeader>(
    'INSERT INTO projects (nama_project, lead_employee_id) VALUES (?, ?)',
    ['EMS V1', leadEmployeeId],
  );
  return result.insertId;
}

test('MySQL baseline migration and constraints', async (suite) => {
  await executeMigration('down', true);
  await executeMigration('up', true);
  const connection = await mysql.createConnection(getDatabaseConfig(true));

  try {
    await suite.test('creates all tables with the required engine and collation', async () => {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT TABLE_NAME, ENGINE, TABLE_COLLATION
           FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME IN ('users', 'employees', 'projects', 'project_members', 'tasks')
          ORDER BY TABLE_NAME`,
        [testDatabase],
      );

      assert.equal(rows.length, 5);
      for (const row of rows) {
        assert.equal(row.ENGINE, 'InnoDB');
        assert.equal(row.TABLE_COLLATION, 'utf8mb4_unicode_ci');
      }
    });

    await suite.test('creates columns with the required type and nullability', async () => {
      const [rows] = await connection.execute<ColumnRow[]>(
        `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME IN ('users', 'employees', 'projects', 'project_members', 'tasks')`,
        [testDatabase],
      );
      const columns = new Map(
        rows.map((row) => [`${row.TABLE_NAME}.${row.COLUMN_NAME}`, row]),
      );

      const expected = [
        ['users.user_id', 'bigint unsigned', 'NO'],
        ['users.nama', 'varchar(100)', 'NO'],
        ['users.email', 'varchar(255)', 'NO'],
        ['users.password_hash', 'varchar(255)', 'NO'],
        ['employees.employee_id', 'bigint unsigned', 'NO'],
        ['employees.user_id', 'bigint unsigned', 'NO'],
        ['employees.role', 'varchar(32)', 'NO'],
        ['employees.tanggal_masuk', 'date', 'NO'],
        ['projects.project_id', 'bigint unsigned', 'NO'],
        ['projects.nama_project', 'varchar(150)', 'NO'],
        ['projects.lead_employee_id', 'bigint unsigned', 'NO'],
        ['project_members.project_id', 'bigint unsigned', 'NO'],
        ['project_members.employee_id', 'bigint unsigned', 'NO'],
        ['tasks.task_id', 'bigint unsigned', 'NO'],
        ['tasks.nama_task', 'varchar(200)', 'NO'],
        ['tasks.project_id', 'bigint unsigned', 'NO'],
        ['tasks.assigned_employee_id', 'bigint unsigned', 'YES'],
        ['tasks.status', 'varchar(20)', 'NO'],
      ] as const;

      assert.equal(rows.length, expected.length);
      for (const [key, type, nullable] of expected) {
        const column = columns.get(key);
        assert.ok(column, `Missing column ${key}`);
        const normalizedType = column.COLUMN_TYPE.replace(/^bigint\(\d+\)/, 'bigint');
        assert.equal(normalizedType, type, `Unexpected type for ${key}`);
        assert.equal(column.IS_NULLABLE, nullable, `Unexpected nullability for ${key}`);
      }
      assert.match(columns.get('users.user_id')?.EXTRA ?? '', /auto_increment/);
      assert.match(columns.get('employees.employee_id')?.EXTRA ?? '', /auto_increment/);
      assert.match(columns.get('projects.project_id')?.EXTRA ?? '', /auto_increment/);
      assert.match(columns.get('tasks.task_id')?.EXTRA ?? '', /auto_increment/);
      const statusDefault = columns
        .get('tasks.status')
        ?.COLUMN_DEFAULT?.replace(/^'(.*)'$/, '$1');
      assert.equal(statusDefault, 'TODO');
    });

    await suite.test('accepts a user and rejects duplicate email', async () => {
      await clearData(connection);
      await insertUser(connection, 'unique');
      await expectMySqlError(
        () =>
          connection.execute(
            'INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)',
            ['Duplicate', 'unique@example.com', '$2b$12$another.hash'],
          ),
        'ER_DUP_ENTRY',
      );
    });

    await suite.test('enforces employee user relation, uniqueness, and role', async () => {
      await clearData(connection);
      const userId = await insertUser(connection, 'employee');
      await connection.execute(
        'INSERT INTO employees (user_id, role, tanggal_masuk) VALUES (?, ?, ?)',
        [userId, 'ADMIN', '2026-01-15'],
      );

      await expectMySqlError(
        () =>
          connection.execute(
            'INSERT INTO employees (user_id, role, tanggal_masuk) VALUES (?, ?, ?)',
            [userId, 'STAFF', '2026-01-16'],
          ),
        'ER_DUP_ENTRY',
      );
      await expectMySqlError(
        () =>
          connection.execute(
            'INSERT INTO employees (user_id, role, tanggal_masuk) VALUES (?, ?, ?)',
            [999_999, 'STAFF', '2026-01-16'],
          ),
        'ER_NO_REFERENCED_ROW_2',
      );

      const otherUserId = await insertUser(connection, 'invalid-role');
      await expectMySqlError(
        () =>
          connection.execute(
            'INSERT INTO employees (user_id, role, tanggal_masuk) VALUES (?, ?, ?)',
            [otherUserId, 'OWNER', '2026-01-16'],
          ),
        'ER_CHECK_CONSTRAINT_VIOLATED',
        'ER_CONSTRAINT_FAILED',
        'ER_INNODB_AUTOEXTEND_SIZE_OUT_OF_RANGE',
      );
    });

    await suite.test('requires every project to reference an existing lead', async () => {
      await clearData(connection);
      const leadId = await insertEmployee(connection, 'lead', 'ADMIN');
      await insertProject(connection, leadId);

      await expectMySqlError(
        () => connection.execute('INSERT INTO projects (nama_project) VALUES (?)', ['No lead']),
        'ER_NO_DEFAULT_FOR_FIELD',
        'ER_NO_REFERENCED_ROW_2',
      );
      await expectMySqlError(
        () =>
          connection.execute(
            'INSERT INTO projects (nama_project, lead_employee_id) VALUES (?, ?)',
            ['Missing lead', 999_999],
          ),
        'ER_NO_REFERENCED_ROW_2',
      );
    });

    await suite.test('enforces project member relations and composite uniqueness', async () => {
      await clearData(connection);
      const leadId = await insertEmployee(connection, 'member-lead', 'ADMIN');
      const memberId = await insertEmployee(connection, 'member');
      const projectId = await insertProject(connection, leadId);
      await connection.execute(
        'INSERT INTO project_members (project_id, employee_id) VALUES (?, ?)',
        [projectId, memberId],
      );

      await expectMySqlError(
        () =>
          connection.execute(
            'INSERT INTO project_members (project_id, employee_id) VALUES (?, ?)',
            [projectId, memberId],
          ),
        'ER_DUP_ENTRY',
      );
      await expectMySqlError(
        () =>
          connection.execute(
            'INSERT INTO project_members (project_id, employee_id) VALUES (?, ?)',
            [999_999, memberId],
          ),
        'ER_NO_REFERENCED_ROW_2',
      );
      await expectMySqlError(
        () =>
          connection.execute(
            'INSERT INTO project_members (project_id, employee_id) VALUES (?, ?)',
            [projectId, 999_999],
          ),
        'ER_NO_REFERENCED_ROW_2',
      );
    });

    await suite.test('applies task defaults and validates task relations and status', async () => {
      await clearData(connection);
      const leadId = await insertEmployee(connection, 'task-lead', 'ADMIN');
      const assigneeId = await insertEmployee(connection, 'task-assignee');
      const projectId = await insertProject(connection, leadId);
      const [result] = await connection.execute<ResultSetHeader>(
        'INSERT INTO tasks (nama_task, project_id) VALUES (?, ?)',
        ['Unassigned task', projectId],
      );
      const [rows] = await connection.execute<TaskRow[]>(
        'SELECT assigned_employee_id, status FROM tasks WHERE task_id = ?',
        [result.insertId],
      );
      assert.deepEqual(rows[0], { assigned_employee_id: null, status: 'TODO' });

      await connection.execute(
        'INSERT INTO tasks (nama_task, project_id, assigned_employee_id, status) VALUES (?, ?, ?, ?)',
        ['Assigned task', projectId, assigneeId, 'IN_PROGRESS'],
      );
      await expectMySqlError(
        () =>
          connection.execute(
            'INSERT INTO tasks (nama_task, project_id) VALUES (?, ?)',
            ['Missing project', 999_999],
          ),
        'ER_NO_REFERENCED_ROW_2',
      );
      await expectMySqlError(
        () =>
          connection.execute(
            'INSERT INTO tasks (nama_task, project_id, assigned_employee_id) VALUES (?, ?, ?)',
            ['Missing employee', projectId, 999_999],
          ),
        'ER_NO_REFERENCED_ROW_2',
      );
      await expectMySqlError(
        () =>
          connection.execute(
            'INSERT INTO tasks (nama_task, project_id, status) VALUES (?, ?, ?)',
            ['Invalid status', projectId, 'CANCELLED'],
          ),
        'ER_CHECK_CONSTRAINT_VIOLATED',
        'ER_CONSTRAINT_FAILED',
        'ER_INNODB_AUTOEXTEND_SIZE_OUT_OF_RANGE',
      );
    });

    await suite.test('restricts deletion of referenced parent records', async () => {
      await clearData(connection);
      const leadId = await insertEmployee(connection, 'restricted-lead', 'ADMIN');
      await insertProject(connection, leadId);

      await expectMySqlError(
        () => connection.execute('DELETE FROM employees WHERE employee_id = ?', [leadId]),
        'ER_ROW_IS_REFERENCED_2',
      );
    });
  } finally {
    await connection.end();
  }

  await suite.test('rolls back and can be applied again', async () => {
    await executeMigration('down', true);
    const verificationConnection = await mysql.createConnection(getDatabaseConfig(true));
    try {
      const [rows] = await verificationConnection.execute<CountRow[]>(
        `SELECT COUNT(*) AS count
           FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME IN ('users', 'employees', 'projects', 'project_members', 'tasks')`,
        [testDatabase],
      );
      assert.equal(rows[0]?.count, '0');
    } finally {
      await verificationConnection.end();
    }

    await executeMigration('up', true);
  });
});
