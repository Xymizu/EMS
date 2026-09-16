import assert from 'node:assert/strict';
import test from 'node:test';

import bcrypt from 'bcryptjs';
import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import request from 'supertest';

import { createApp } from '../../src/app.js';
import { getDatabaseConfig } from '../../src/config/database.js';
import type { JwtConfig } from '../../src/config/jwt.js';
import { executeMigration } from '../../src/database/migration.js';
import { createEmployeeRepository } from '../../src/modules/employee/employee.repository.js';
import type { EmployeeRole } from '../../src/modules/employee/employee.types.js';
import { createTokenService } from '../../src/modules/auth/token.service.js';

const jwtConfig: JwtConfig = {
  secret: 'employee-http-secret-with-at-least-32-characters',
  accessTokenTtlSeconds: 900,
  issuer: 'ems-api',
  audience: 'ems-client',
};
const originalPassword = 'Password123!';
const fixtureHash = bcrypt.hashSync(originalPassword, 4);

interface CountRow extends RowDataPacket { count: string; }
interface HashRow extends RowDataPacket { password_hash: string; }

async function clearData(pool: Pool): Promise<void> {
  await pool.query('DELETE FROM tasks');
  await pool.query('DELETE FROM project_members');
  await pool.query('DELETE FROM projects');
  await pool.query('DELETE FROM employees');
  await pool.query('DELETE FROM users');
}

async function seedActor(pool: Pool, role: EmployeeRole): Promise<{ userId: string; employeeId: string }> {
  const [user] = await pool.execute<ResultSetHeader>(
    'INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)',
    [`${role} Actor`, `${role.toLowerCase()}@example.com`, fixtureHash],
  );
  const userId = String(user.insertId);
  const [employee] = await pool.execute<ResultSetHeader>(
    'INSERT INTO employees (user_id, role, tanggal_masuk) VALUES (?, ?, ?)',
    [userId, role, '2026-01-01'],
  );
  return { userId, employeeId: String(employee.insertId) };
}

const createBody = {
  nama: '  Budi Santoso  ',
  email: '  BUDI@EXAMPLE.COM ',
  password: originalPassword,
  tanggal_masuk: '2026-09-16',
  role: 'STAFF',
};

test('employee management HTTP API', async (suite) => {
  await executeMigration('down', true);
  await executeMigration('up', true);
  const pool = mysql.createPool({ ...getDatabaseConfig(true), connectionLimit: 3 });
  const app = createApp({ pool, jwtConfig, passwordHashRounds: 4 });
  const tokenService = createTokenService(jwtConfig);

  suite.beforeEach(async () => {
    await clearData(pool);
  });

  try {
    await suite.test('all endpoints require authentication', async () => {
      const responses = await Promise.all([
        request(app).post('/employees').send(createBody),
        request(app).get('/employees'),
        request(app).get('/employees/1'),
        request(app).patch('/employees/1').send({ nama: 'New' }),
      ]);
      for (const response of responses) {
        assert.equal(response.status, 401);
        assert.equal(response.body.error.code, 'UNAUTHORIZED');
      }
    });

    await suite.test('Staff is forbidden on every endpoint', async () => {
      await clearData(pool);
      const actor = await seedActor(pool, 'STAFF');
      const token = await tokenService.sign({ userId: actor.userId });
      const authorization = { authorization: `Bearer ${token}` };
      const responses = await Promise.all([
        request(app).post('/employees').set(authorization).send(createBody),
        request(app).get('/employees').set(authorization),
        request(app).get('/employees/999').set(authorization),
        request(app).patch('/employees/999').set(authorization).send({ nama: 'New' }),
      ]);
      for (const response of responses) {
        assert.equal(response.status, 403);
        assert.deepEqual(response.body, {
          error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
        });
      }
    });

    await suite.test('Admin creates user and employee with a bcrypt hash', async () => {
      await clearData(pool);
      const actor = await seedActor(pool, 'ADMIN');
      const token = await tokenService.sign({ userId: actor.userId });
      const response = await request(app)
        .post('/employees')
        .set('authorization', `Bearer ${token}`)
        .send(createBody);

      assert.equal(response.status, 201);
      assert.equal(response.body.data.employee.nama, 'Budi Santoso');
      assert.equal(response.body.data.employee.email, 'budi@example.com');
      assert.equal(response.body.data.employee.tanggalMasuk, '2026-09-16');
      assert.equal(response.body.data.employee.role, 'STAFF');
      assert.equal(typeof response.body.data.employee.userId, 'string');
      assert.equal(typeof response.body.data.employee.employeeId, 'string');
      assert.doesNotMatch(JSON.stringify(response.body), /password/i);

      const [rows] = await pool.execute<HashRow[]>(
        'SELECT password_hash FROM users WHERE email = ?', ['budi@example.com'],
      );
      assert.ok(rows[0]);
      assert.equal(await bcrypt.compare(originalPassword, rows[0].password_hash), true);
      assert.notEqual(rows[0].password_hash, originalPassword);
    });

    await suite.test('duplicate email returns 409 without an extra employee', async () => {
      await clearData(pool);
      const actor = await seedActor(pool, 'ADMIN');
      const token = await tokenService.sign({ userId: actor.userId });
      await request(app).post('/employees').set('authorization', `Bearer ${token}`).send(createBody);
      const duplicate = await request(app)
        .post('/employees')
        .set('authorization', `Bearer ${token}`)
        .send({ ...createBody, nama: 'Duplicate' });
      assert.equal(duplicate.status, 409);
      assert.equal(duplicate.body.error.code, 'EMAIL_ALREADY_EXISTS');
      const [counts] = await pool.query<CountRow[]>('SELECT COUNT(*) AS count FROM employees');
      assert.equal(counts[0]?.count, '2');
    });

    await suite.test('create transaction rolls back user when employee insert fails', async () => {
      await clearData(pool);
      const repository = createEmployeeRepository(pool);
      await assert.rejects(
        repository.create({
          nama: 'Rollback', email: 'rollback@example.com', passwordHash: fixtureHash,
          tanggalMasuk: '2026-01-01', role: 'INVALID' as EmployeeRole,
        }),
      );
      const [counts] = await pool.execute<CountRow[]>(
        'SELECT COUNT(*) AS count FROM users WHERE email = ?', ['rollback@example.com'],
      );
      assert.equal(counts[0]?.count, '0');
    });

    await suite.test('Super Admin can list and read employee detail in ID order', async () => {
      await clearData(pool);
      const actor = await seedActor(pool, 'SUPER_ADMIN');
      const token = await tokenService.sign({ userId: actor.userId });
      const created = await request(app)
        .post('/employees').set('authorization', `Bearer ${token}`).send(createBody);
      const list = await request(app).get('/employees').set('authorization', `Bearer ${token}`);
      assert.equal(list.status, 200);
      assert.equal(list.body.data.employees.length, 2);
      assert.ok(
        BigInt(list.body.data.employees[0].employeeId) <
          BigInt(list.body.data.employees[1].employeeId),
      );
      const detail = await request(app)
        .get(`/employees/${created.body.data.employee.employeeId}`)
        .set('authorization', `Bearer ${token}`);
      assert.equal(detail.status, 200);
      assert.deepEqual(detail.body.data.employee, created.body.data.employee);
    });

    await suite.test('detail validates ID and returns 404 for missing employee', async () => {
      await clearData(pool);
      const actor = await seedActor(pool, 'ADMIN');
      const token = await tokenService.sign({ userId: actor.userId });
      const invalid = await request(app).get('/employees/0').set('authorization', `Bearer ${token}`);
      const missing = await request(app).get('/employees/999999').set('authorization', `Bearer ${token}`);
      assert.equal(invalid.status, 400);
      assert.equal(missing.status, 404);
      assert.equal(missing.body.error.code, 'EMPLOYEE_NOT_FOUND');
    });

    await suite.test('patch updates fields and password without exposing its hash', async () => {
      await clearData(pool);
      const actor = await seedActor(pool, 'ADMIN');
      const token = await tokenService.sign({ userId: actor.userId });
      const created = await request(app)
        .post('/employees').set('authorization', `Bearer ${token}`).send(createBody);
      const employeeId = created.body.data.employee.employeeId;
      const newPassword = 'NewPassword456!';
      const response = await request(app)
        .patch(`/employees/${employeeId}`)
        .set('authorization', `Bearer ${token}`)
        .send({
          nama: 'Budi Updated', email: 'updated@example.com', password: newPassword,
          tanggal_masuk: '2026-10-01', role: 'ADMIN', ignored: 'value',
        });
      assert.equal(response.status, 200);
      assert.deepEqual(response.body.data.employee, {
        employeeId,
        userId: created.body.data.employee.userId,
        nama: 'Budi Updated', email: 'updated@example.com',
        tanggalMasuk: '2026-10-01', role: 'ADMIN',
      });
      assert.doesNotMatch(JSON.stringify(response.body), /password/i);
      const [rows] = await pool.execute<HashRow[]>(
        'SELECT password_hash FROM users WHERE email = ?', ['updated@example.com'],
      );
      assert.ok(rows[0]);
      assert.equal(await bcrypt.compare(newPassword, rows[0].password_hash), true);
      assert.equal(await bcrypt.compare(originalPassword, rows[0].password_hash), false);
    });

    await suite.test('invalid patch is rejected and duplicate email rolls back all fields', async () => {
      await clearData(pool);
      const actor = await seedActor(pool, 'ADMIN');
      const token = await tokenService.sign({ userId: actor.userId });
      const first = await request(app)
        .post('/employees').set('authorization', `Bearer ${token}`).send(createBody);
      await request(app).post('/employees').set('authorization', `Bearer ${token}`).send({
        ...createBody, email: 'other@example.com', nama: 'Other Employee',
      });
      const empty = await request(app)
        .patch(`/employees/${first.body.data.employee.employeeId}`)
        .set('authorization', `Bearer ${token}`).send({});
      assert.equal(empty.status, 400);
      const conflict = await request(app)
        .patch(`/employees/${first.body.data.employee.employeeId}`)
        .set('authorization', `Bearer ${token}`)
        .send({ nama: 'Should Rollback', email: 'other@example.com' });
      assert.equal(conflict.status, 409);
      const detail = await request(app)
        .get(`/employees/${first.body.data.employee.employeeId}`)
        .set('authorization', `Bearer ${token}`);
      assert.equal(detail.body.data.employee.nama, 'Budi Santoso');
      assert.equal(detail.body.data.employee.email, 'budi@example.com');
    });

    await suite.test('patch missing employee returns 404', async () => {
      await clearData(pool);
      const actor = await seedActor(pool, 'ADMIN');
      const token = await tokenService.sign({ userId: actor.userId });
      const response = await request(app)
        .patch('/employees/999999')
        .set('authorization', `Bearer ${token}`).send({ nama: 'Missing' });
      assert.equal(response.status, 404);
    });
  } finally {
    await clearData(pool);
    await pool.end();
  }
});
