import assert from 'node:assert/strict';
import test from 'node:test';

import bcrypt from 'bcryptjs';
import mysql, {
  type Pool,
  type ResultSetHeader,
  type RowDataPacket,
} from 'mysql2/promise';
import request from 'supertest';

import { createApp } from '../../src/app.js';
import { getDatabaseConfig } from '../../src/config/database.js';
import type { JwtConfig } from '../../src/config/jwt.js';
import { executeMigration } from '../../src/database/migration.js';
import { createTokenService } from '../../src/modules/auth/token.service.js';
import type { EmployeeRole } from '../../src/modules/employee/employee.types.js';

const jwtConfig: JwtConfig = {
  secret: 'project-http-secret-with-at-least-32-characters',
  accessTokenTtlSeconds: 900,
  issuer: 'ems-api',
  audience: 'ems-client',
};
const fixtureHash = bcrypt.hashSync('Password123!', 4);

interface CountRow extends RowDataPacket { count: string; }

async function clearData(pool: Pool): Promise<void> {
  await pool.query('DELETE FROM tasks');
  await pool.query('DELETE FROM project_members');
  await pool.query('DELETE FROM projects');
  await pool.query('DELETE FROM employees');
  await pool.query('DELETE FROM users');
}

async function seedEmployee(
  pool: Pool,
  role: EmployeeRole,
  suffix: string,
): Promise<{ userId: string; employeeId: string }> {
  const [user] = await pool.execute<ResultSetHeader>(
    'INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)',
    [`${role} ${suffix}`, `${role.toLowerCase()}-${suffix}@example.com`, fixtureHash],
  );
  const userId = String(user.insertId);
  const [employee] = await pool.execute<ResultSetHeader>(
    'INSERT INTO employees (user_id, role, tanggal_masuk) VALUES (?, ?, ?)',
    [userId, role, '2026-01-01'],
  );
  return { userId, employeeId: String(employee.insertId) };
}

test('project management HTTP API', async (suite) => {
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
        request(app).post('/projects').send({ nama_project: 'EMS', lead_employee_id: '1' }),
        request(app).get('/projects'),
        request(app).get('/projects/1'),
        request(app).patch('/projects/1').send({ nama_project: 'New' }),
        request(app).delete('/projects/1'),
      ]);
      for (const response of responses) {
        assert.equal(response.status, 401);
        assert.equal(response.body.error.code, 'UNAUTHORIZED');
      }
    });

    await suite.test('Staff is forbidden before project lookup', async () => {
      await clearData(pool);
      const actor = await seedEmployee(pool, 'STAFF', 'actor');
      const token = await tokenService.sign({ userId: actor.userId });
      const authorization = { authorization: `Bearer ${token}` };
      const responses = await Promise.all([
        request(app).post('/projects').set(authorization)
          .send({ nama_project: 'EMS', lead_employee_id: actor.employeeId }),
        request(app).get('/projects').set(authorization),
        request(app).get('/projects/999').set(authorization),
        request(app).patch('/projects/999').set(authorization).send({ nama_project: 'New' }),
        request(app).delete('/projects/999').set(authorization),
      ]);
      for (const response of responses) {
        assert.equal(response.status, 403);
        assert.equal(response.body.error.code, 'FORBIDDEN');
      }
    });

    await suite.test('Admin performs create, list, detail, patch, and delete', async () => {
      await clearData(pool);
      const actor = await seedEmployee(pool, 'ADMIN', 'actor');
      const lead = await seedEmployee(pool, 'STAFF', 'lead');
      const newLead = await seedEmployee(pool, 'SUPER_ADMIN', 'new-lead');
      const token = await tokenService.sign({ userId: actor.userId });
      const authorization = { authorization: `Bearer ${token}` };

      const created = await request(app).post('/projects').set(authorization).send({
        nama_project: '  Employee Management System  ',
        lead_employee_id: lead.employeeId,
      });
      assert.equal(created.status, 201);
      assert.equal(created.body.data.project.namaProject, 'Employee Management System');
      assert.equal(created.body.data.project.lead.employeeId, lead.employeeId);
      assert.equal(typeof created.body.data.project.projectId, 'string');
      assert.doesNotMatch(JSON.stringify(created.body), /password/i);
      const projectId: string = created.body.data.project.projectId;

      const [memberCounts] = await pool.execute<CountRow[]>(
        'SELECT COUNT(*) AS count FROM project_members WHERE project_id = ?',
        [projectId],
      );
      assert.equal(memberCounts[0]?.count, '0');

      const second = await request(app).post('/projects').set(authorization).send({
        nama_project: 'Second Project',
        lead_employee_id: lead.employeeId,
      });
      assert.equal(second.status, 201);

      const list = await request(app).get('/projects').set(authorization);
      assert.equal(list.status, 200);
      assert.equal(list.body.data.projects.length, 2);
      assert.deepEqual(list.body.data.projects[0], created.body.data.project);
      assert.ok(
        BigInt(list.body.data.projects[0].projectId) <
          BigInt(list.body.data.projects[1].projectId),
      );

      const detail = await request(app).get(`/projects/${projectId}`).set(authorization);
      assert.equal(detail.status, 200);
      assert.deepEqual(detail.body.data.project, created.body.data.project);

      const updated = await request(app).patch(`/projects/${projectId}`)
        .set(authorization)
        .send({ nama_project: 'EMS API V2', lead_employee_id: newLead.employeeId });
      assert.equal(updated.status, 200);
      assert.equal(updated.body.data.project.namaProject, 'EMS API V2');
      assert.equal(updated.body.data.project.lead.employeeId, newLead.employeeId);

      const removed = await request(app).delete(`/projects/${projectId}`).set(authorization);
      assert.equal(removed.status, 204);
      assert.equal(removed.text, '');
      const secondRemoved = await request(app)
        .delete(`/projects/${second.body.data.project.projectId}`)
        .set(authorization);
      assert.equal(secondRemoved.status, 204);
      const missing = await request(app).get(`/projects/${projectId}`).set(authorization);
      assert.equal(missing.status, 404);
      assert.equal(missing.body.error.code, 'PROJECT_NOT_FOUND');
    });

    await suite.test('Super Admin receives empty list', async () => {
      await clearData(pool);
      const actor = await seedEmployee(pool, 'SUPER_ADMIN', 'actor');
      const token = await tokenService.sign({ userId: actor.userId });
      const response = await request(app)
        .get('/projects').set('authorization', `Bearer ${token}`);
      assert.equal(response.status, 200);
      assert.deepEqual(response.body, { data: { projects: [] } });
    });

    await suite.test('validation and missing targets return stable errors', async () => {
      await clearData(pool);
      const actor = await seedEmployee(pool, 'ADMIN', 'actor');
      const token = await tokenService.sign({ userId: actor.userId });
      const authorization = { authorization: `Bearer ${token}` };
      const invalidCreate = await request(app).post('/projects').set(authorization)
        .send({ nama_project: 'EMS', lead_employee_id: actor.employeeId, extra: true });
      assert.equal(invalidCreate.status, 400);
      const missingLead = await request(app).post('/projects').set(authorization)
        .send({ nama_project: 'EMS', lead_employee_id: '999999' });
      assert.equal(missingLead.status, 404);
      assert.equal(missingLead.body.error.code, 'LEAD_EMPLOYEE_NOT_FOUND');
      const invalidId = await request(app).get('/projects/0').set(authorization);
      assert.equal(invalidId.status, 400);
      const missingProject = await request(app).get('/projects/999999').set(authorization);
      assert.equal(missingProject.status, 404);
      assert.equal(missingProject.body.error.code, 'PROJECT_NOT_FOUND');
      const emptyPatch = await request(app).patch('/projects/999999')
        .set(authorization).send({});
      assert.equal(emptyPatch.status, 400);
    });

    await suite.test('delete rejects member and task dependencies without data loss', async () => {
      await clearData(pool);
      const actor = await seedEmployee(pool, 'ADMIN', 'actor');
      const lead = await seedEmployee(pool, 'STAFF', 'lead');
      const token = await tokenService.sign({ userId: actor.userId });
      const authorization = { authorization: `Bearer ${token}` };

      for (const dependency of ['member', 'task'] as const) {
        const created = await request(app).post('/projects').set(authorization).send({
          nama_project: `Project ${dependency}`,
          lead_employee_id: lead.employeeId,
        });
        const projectId: string = created.body.data.project.projectId;
        if (dependency === 'member') {
          await pool.execute(
            'INSERT INTO project_members (project_id, employee_id) VALUES (?, ?)',
            [projectId, lead.employeeId],
          );
        } else {
          await pool.execute(
            'INSERT INTO tasks (nama_task, project_id, assigned_employee_id) VALUES (?, ?, ?)',
            ['Task', projectId, lead.employeeId],
          );
        }
        const response = await request(app).delete(`/projects/${projectId}`).set(authorization);
        assert.equal(response.status, 409);
        assert.equal(response.body.error.code, 'PROJECT_HAS_DEPENDENCIES');
        const detail = await request(app).get(`/projects/${projectId}`).set(authorization);
        assert.equal(detail.status, 200);
      }
    });
  } finally {
    await clearData(pool);
    await pool.end();
  }
});
