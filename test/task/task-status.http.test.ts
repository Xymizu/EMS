import assert from 'node:assert/strict';
import test from 'node:test';

import bcrypt from 'bcryptjs';
import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import request from 'supertest';

import { createApp } from '../../src/app.js';
import { getDatabaseConfig } from '../../src/config/database.js';
import type { JwtConfig } from '../../src/config/jwt.js';
import { executeMigration } from '../../src/database/migration.js';
import { createTokenService } from '../../src/modules/auth/token.service.js';
import type { EmployeeRole } from '../../src/modules/employee/employee.types.js';
import type { TaskStatus } from '../../src/modules/task/task.types.js';

const jwtConfig: JwtConfig = {
  secret: 'task-status-http-secret-with-at-least-32-characters',
  accessTokenTtlSeconds: 900,
  issuer: 'ems-api',
  audience: 'ems-client',
};
const fixtureHash = bcrypt.hashSync('Password123!', 4);

interface StatusRow extends RowDataPacket { status: TaskStatus; }

async function clearData(pool: Pool): Promise<void> {
  await pool.query('DELETE FROM tasks');
  await pool.query('DELETE FROM project_members');
  await pool.query('DELETE FROM projects');
  await pool.query('DELETE FROM employees');
  await pool.query('DELETE FROM users');
}

async function seedUser(pool: Pool, suffix: string): Promise<string> {
  const [user] = await pool.execute<ResultSetHeader>(
    'INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)',
    [`User ${suffix}`, `${suffix}@example.com`, fixtureHash],
  );
  return String(user.insertId);
}

async function seedEmployee(
  pool: Pool,
  role: EmployeeRole,
  suffix: string,
): Promise<{ userId: string; employeeId: string }> {
  const userId = await seedUser(pool, suffix);
  const [employee] = await pool.execute<ResultSetHeader>(
    'INSERT INTO employees (user_id, role, tanggal_masuk) VALUES (?, ?, ?)',
    [userId, role, '2026-01-01'],
  );
  return { userId, employeeId: String(employee.insertId) };
}

async function seedProject(pool: Pool, leadId: string, name: string): Promise<string> {
  const [project] = await pool.execute<ResultSetHeader>(
    'INSERT INTO projects (nama_project, lead_employee_id) VALUES (?, ?)',
    [name, leadId],
  );
  return String(project.insertId);
}

async function seedTask(
  pool: Pool,
  projectId: string,
  assigneeId: string,
  status: TaskStatus = 'TODO',
): Promise<string> {
  await pool.execute(
    'INSERT INTO project_members (project_id, employee_id) VALUES (?, ?)',
    [projectId, assigneeId],
  );
  const [task] = await pool.execute<ResultSetHeader>(
    `INSERT INTO tasks (nama_task, project_id, assigned_employee_id, status)
     VALUES (?, ?, ?, ?)`,
    ['Status task', projectId, assigneeId, status],
  );
  return String(task.insertId);
}

async function statusOf(pool: Pool, taskId: string): Promise<TaskStatus> {
  const [rows] = await pool.execute<StatusRow[]>(
    'SELECT status FROM tasks WHERE task_id = ?',
    [taskId],
  );
  const row = rows[0];
  if (!row) throw new Error('Task fixture missing');
  return row.status;
}

test('task status HTTP API', async (suite) => {
  await executeMigration('down', true);
  await executeMigration('up', true);
  const pool = mysql.createPool({ ...getDatabaseConfig(true), connectionLimit: 8 });
  const app = createApp({ pool, jwtConfig, passwordHashRounds: 4 });
  const tokenService = createTokenService(jwtConfig);

  try {
    await suite.test('requires authentication and validates request strictly', async () => {
      const unauthenticated = await request(app)
        .patch('/tasks/1/status').send({ status: 'IN_PROGRESS' });
      assert.equal(unauthenticated.status, 401);

      await clearData(pool);
      const admin = await seedEmployee(pool, 'ADMIN', 'admin-validation');
      const token = await tokenService.sign({ userId: admin.userId });
      const invalidBodies: object[] = [
        {}, { status: 'done' }, { status: ' DONE ' },
        { status: null }, { status: 'DONE', ignored: true },
      ];
      for (const body of invalidBodies) {
        const response = await request(app).patch('/tasks/1/status')
          .set('authorization', `Bearer ${token}`).send(body);
        assert.equal(response.status, 400);
        assert.equal(response.body.error.code, 'VALIDATION_ERROR');
      }
    });

    await suite.test('user without employee is forbidden before task lookup', async () => {
      await clearData(pool);
      const userId = await seedUser(pool, 'without-employee');
      const token = await tokenService.sign({ userId });
      const response = await request(app).patch('/tasks/999999/status')
        .set('authorization', `Bearer ${token}`).send({ status: 'IN_PROGRESS' });
      assert.equal(response.status, 403);
      assert.equal(response.body.error.code, 'FORBIDDEN');
    });

    await suite.test('assignee and project lead can update only related tasks', async () => {
      await clearData(pool);
      const lead = await seedEmployee(pool, 'STAFF', 'lead');
      const otherLead = await seedEmployee(pool, 'STAFF', 'other-lead');
      const assignee = await seedEmployee(pool, 'STAFF', 'assignee');
      const otherStaff = await seedEmployee(pool, 'STAFF', 'other-staff');
      const projectId = await seedProject(pool, lead.employeeId, 'Lead project');
      const otherProjectId = await seedProject(pool, otherLead.employeeId, 'Other project');
      const taskId = await seedTask(pool, projectId, assignee.employeeId);
      const otherTaskId = await seedTask(pool, otherProjectId, otherStaff.employeeId);
      const assigneeToken = await tokenService.sign({ userId: assignee.userId });
      const leadToken = await tokenService.sign({ userId: lead.userId });
      const unrelatedToken = await tokenService.sign({ userId: otherStaff.userId });

      const own = await request(app).patch(`/tasks/${taskId}/status`)
        .set('authorization', `Bearer ${assigneeToken}`)
        .send({ status: 'IN_PROGRESS' });
      assert.equal(own.status, 200);
      assert.equal(own.body.data.task.status, 'IN_PROGRESS');
      assert.equal(own.body.data.task.assignee.employeeId, assignee.employeeId);
      assert.doesNotMatch(JSON.stringify(own.body), /password/i);

      const unrelated = await request(app).patch(`/tasks/${taskId}/status`)
        .set('authorization', `Bearer ${unrelatedToken}`).send({ status: 'DONE' });
      assert.equal(unrelated.status, 403);
      assert.equal(await statusOf(pool, taskId), 'IN_PROGRESS');

      const leadUpdate = await request(app).patch(`/tasks/${taskId}/status`)
        .set('authorization', `Bearer ${leadToken}`).send({ status: 'DONE' });
      assert.equal(leadUpdate.status, 200);
      const wrongProject = await request(app).patch(`/tasks/${otherTaskId}/status`)
        .set('authorization', `Bearer ${leadToken}`).send({ status: 'IN_PROGRESS' });
      assert.equal(wrongProject.status, 403);
      assert.equal(await statusOf(pool, otherTaskId), 'TODO');
    });

    await suite.test('Admin and Super Admin can update any task but cannot bypass transitions', async () => {
      await clearData(pool);
      const lead = await seedEmployee(pool, 'STAFF', 'lead-admin-test');
      const assignee = await seedEmployee(pool, 'STAFF', 'assignee-admin-test');
      const admin = await seedEmployee(pool, 'ADMIN', 'admin');
      const superAdmin = await seedEmployee(pool, 'SUPER_ADMIN', 'super-admin');
      const projectId = await seedProject(pool, lead.employeeId, 'Admin project');
      const taskId = await seedTask(pool, projectId, assignee.employeeId);
      const adminToken = await tokenService.sign({ userId: admin.userId });
      const superToken = await tokenService.sign({ userId: superAdmin.userId });

      const adminUpdate = await request(app).patch(`/tasks/${taskId}/status`)
        .set('authorization', `Bearer ${adminToken}`).send({ status: 'IN_PROGRESS' });
      assert.equal(adminUpdate.status, 200);
      const superUpdate = await request(app).patch(`/tasks/${taskId}/status`)
        .set('authorization', `Bearer ${superToken}`).send({ status: 'DONE' });
      assert.equal(superUpdate.status, 200);
      const invalid = await request(app).patch(`/tasks/${taskId}/status`)
        .set('authorization', `Bearer ${superToken}`).send({ status: 'TODO' });
      assert.equal(invalid.status, 400);
      assert.equal(invalid.body.error.code, 'INVALID_TASK_STATUS_TRANSITION');
      assert.equal(await statusOf(pool, taskId), 'DONE');

      await pool.execute('UPDATE employees SET role = ? WHERE employee_id = ?', [
        'STAFF', admin.employeeId,
      ]);
      const staleRoleToken = await request(app).patch(`/tasks/${taskId}/status`)
        .set('authorization', `Bearer ${adminToken}`).send({ status: 'IN_PROGRESS' });
      assert.equal(staleRoleToken.status, 403);
    });

    await suite.test('all nine transition pairs follow the state machine', async () => {
      await clearData(pool);
      const admin = await seedEmployee(pool, 'ADMIN', 'admin-matrix');
      const lead = await seedEmployee(pool, 'STAFF', 'lead-matrix');
      const assignee = await seedEmployee(pool, 'STAFF', 'assignee-matrix');
      const projectId = await seedProject(pool, lead.employeeId, 'Matrix');
      const taskId = await seedTask(pool, projectId, assignee.employeeId);
      const token = await tokenService.sign({ userId: admin.userId });
      const allowed = new Set([
        'TODO:IN_PROGRESS', 'IN_PROGRESS:TODO',
        'IN_PROGRESS:DONE', 'DONE:IN_PROGRESS',
      ]);
      const statuses: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];
      for (const current of statuses) {
        for (const target of statuses) {
          await pool.execute('UPDATE tasks SET status = ? WHERE task_id = ?', [
            current, taskId,
          ]);
          const response = await request(app).patch(`/tasks/${taskId}/status`)
            .set('authorization', `Bearer ${token}`).send({ status: target });
          const permitted = allowed.has(`${current}:${target}`);
          assert.equal(response.status, permitted ? 200 : 400, `${current} -> ${target}`);
          assert.equal(
            await statusOf(pool, taskId),
            permitted ? target : current,
            `${current} -> ${target}`,
          );
        }
      }
    });

    await suite.test('concurrent transitions serialize and reevaluate latest status', async () => {
      await clearData(pool);
      const admin = await seedEmployee(pool, 'ADMIN', 'admin-concurrent');
      const lead = await seedEmployee(pool, 'STAFF', 'lead-concurrent');
      const assignee = await seedEmployee(pool, 'STAFF', 'assignee-concurrent');
      const projectId = await seedProject(pool, lead.employeeId, 'Concurrent');
      const taskId = await seedTask(pool, projectId, assignee.employeeId, 'IN_PROGRESS');
      const token = await tokenService.sign({ userId: admin.userId });
      const auth = { authorization: `Bearer ${token}` };

      const responses = await Promise.all([
        request(app).patch(`/tasks/${taskId}/status`).set(auth).send({ status: 'TODO' }),
        request(app).patch(`/tasks/${taskId}/status`).set(auth).send({ status: 'DONE' }),
      ]);
      assert.deepEqual(responses.map((response) => response.status).sort(), [200, 400]);
      assert.equal(
        responses.find((response) => response.status === 400)?.body.error.code,
        'INVALID_TASK_STATUS_TRANSITION',
      );
      assert.ok(['TODO', 'DONE'].includes(await statusOf(pool, taskId)));
    });

    await suite.test('missing task returns 404 and regular patch still rejects status', async () => {
      await clearData(pool);
      const admin = await seedEmployee(pool, 'ADMIN', 'admin-missing');
      const token = await tokenService.sign({ userId: admin.userId });
      const auth = { authorization: `Bearer ${token}` };
      const missing = await request(app).patch('/tasks/999999/status')
        .set(auth).send({ status: 'IN_PROGRESS' });
      assert.equal(missing.status, 404);
      assert.equal(missing.body.error.code, 'TASK_NOT_FOUND');
      const regularPatch = await request(app).patch('/tasks/999999')
        .set(auth).send({ status: 'IN_PROGRESS' });
      assert.equal(regularPatch.status, 400);
      assert.equal(regularPatch.body.error.code, 'VALIDATION_ERROR');
    });
  } finally {
    await clearData(pool);
    await pool.end();
  }
});
