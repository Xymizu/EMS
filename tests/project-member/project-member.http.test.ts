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
  secret: 'project-member-http-secret-at-least-32-characters',
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

async function seedProject(
  pool: Pool,
  leadEmployeeId: string,
  name: string,
): Promise<string> {
  const [project] = await pool.execute<ResultSetHeader>(
    'INSERT INTO projects (nama_project, lead_employee_id) VALUES (?, ?)',
    [name, leadEmployeeId],
  );
  return String(project.insertId);
}

test('project member HTTP API', async (suite) => {
  await executeMigration('down', true);
  await executeMigration('up', true);
  const pool = mysql.createPool({ ...getDatabaseConfig(true), connectionLimit: 6 });
  const app = createApp({ pool, jwtConfig, passwordHashRounds: 4 });
  const tokenService = createTokenService(jwtConfig);

  suite.beforeEach(async () => {
    await clearData(pool);
  });

  try {
    await suite.test('all endpoints require authentication', async () => {
      const responses = await Promise.all([
        request(app).get('/projects/1/members'),
        request(app).post('/projects/1/members').send({ employee_id: '2' }),
        request(app).delete('/projects/1/members/2'),
      ]);
      for (const response of responses) {
        assert.equal(response.status, 401);
        assert.equal(response.body.error.code, 'UNAUTHORIZED');
      }
    });

    await suite.test('Staff is forbidden before target lookup', async () => {
      await clearData(pool);
      const actor = await seedEmployee(pool, 'STAFF', 'actor');
      const token = await tokenService.sign({ userId: actor.userId });
      const auth = { authorization: `Bearer ${token}` };
      const responses = await Promise.all([
        request(app).get('/projects/999/members').set(auth),
        request(app).post('/projects/999/members').set(auth)
          .send({ employee_id: '999' }),
        request(app).delete('/projects/999/members/999').set(auth),
      ]);
      for (const response of responses) {
        assert.equal(response.status, 403);
        assert.equal(response.body.error.code, 'FORBIDDEN');
      }
    });

    await suite.test('Admin manages many-to-many memberships with stable ordering', async () => {
      await clearData(pool);
      const actor = await seedEmployee(pool, 'ADMIN', 'actor');
      const first = await seedEmployee(pool, 'STAFF', 'first');
      const second = await seedEmployee(pool, 'SUPER_ADMIN', 'second');
      const projectOne = await seedProject(pool, actor.employeeId, 'One');
      const projectTwo = await seedProject(pool, actor.employeeId, 'Two');
      const token = await tokenService.sign({ userId: actor.userId });
      const auth = { authorization: `Bearer ${token}` };

      const empty = await request(app).get(`/projects/${projectOne}/members`).set(auth);
      assert.equal(empty.status, 200);
      assert.deepEqual(empty.body, { data: { projectId: projectOne, members: [] } });

      const addedSecond = await request(app).post(`/projects/${projectOne}/members`)
        .set(auth).send({ employee_id: second.employeeId });
      const addedFirst = await request(app).post(`/projects/${projectOne}/members`)
        .set(auth).send({ employee_id: first.employeeId });
      const otherProject = await request(app).post(`/projects/${projectTwo}/members`)
        .set(auth).send({ employee_id: first.employeeId });
      assert.equal(addedSecond.status, 201);
      assert.equal(addedFirst.status, 201);
      assert.equal(otherProject.status, 201);
      assert.equal(addedFirst.body.data.projectId, projectOne);
      assert.equal(addedFirst.body.data.member.employeeId, first.employeeId);
      assert.doesNotMatch(JSON.stringify(addedFirst.body), /password/i);

      const list = await request(app).get(`/projects/${projectOne}/members`).set(auth);
      assert.equal(list.status, 200);
      assert.deepEqual(
        list.body.data.members.map((item: { employeeId: string }) => item.employeeId),
        [first.employeeId, second.employeeId],
      );

      const removed = await request(app)
        .delete(`/projects/${projectOne}/members/${first.employeeId}`).set(auth);
      assert.equal(removed.status, 204);
      assert.equal(removed.text, '');
      const projectOneList = await request(app)
        .get(`/projects/${projectOne}/members`).set(auth);
      const projectTwoList = await request(app)
        .get(`/projects/${projectTwo}/members`).set(auth);
      assert.deepEqual(
        projectOneList.body.data.members.map((item: { employeeId: string }) => item.employeeId),
        [second.employeeId],
      );
      assert.deepEqual(
        projectTwoList.body.data.members.map((item: { employeeId: string }) => item.employeeId),
        [first.employeeId],
      );
      const [employees] = await pool.execute<CountRow[]>(
        'SELECT COUNT(*) AS count FROM employees WHERE employee_id = ?',
        [first.employeeId],
      );
      assert.equal(employees[0]?.count, '1');
    });

    await suite.test('Super Admin gets validation and target errors in defined order', async () => {
      await clearData(pool);
      const actor = await seedEmployee(pool, 'SUPER_ADMIN', 'actor');
      const lead = await seedEmployee(pool, 'STAFF', 'lead');
      const projectId = await seedProject(pool, lead.employeeId, 'Target errors');
      const token = await tokenService.sign({ userId: actor.userId });
      const auth = { authorization: `Bearer ${token}` };

      const invalid = await request(app).post(`/projects/${projectId}/members`)
        .set(auth).send({ employee_id: 2, ignored: true });
      assert.equal(invalid.status, 400);
      const missingProject = await request(app).post('/projects/999999/members')
        .set(auth).send({ employee_id: '999999' });
      assert.equal(missingProject.status, 404);
      assert.equal(missingProject.body.error.code, 'PROJECT_NOT_FOUND');
      const missingEmployee = await request(app).post(`/projects/${projectId}/members`)
        .set(auth).send({ employee_id: '999999' });
      assert.equal(missingEmployee.status, 404);
      assert.equal(missingEmployee.body.error.code, 'EMPLOYEE_NOT_FOUND');
      const missingMember = await request(app)
        .delete(`/projects/${projectId}/members/${lead.employeeId}`).set(auth);
      assert.equal(missingMember.status, 404);
      assert.equal(missingMember.body.error.code, 'PROJECT_MEMBER_NOT_FOUND');
    });

    await suite.test('concurrent duplicate requests create exactly one membership', async () => {
      await clearData(pool);
      const actor = await seedEmployee(pool, 'ADMIN', 'actor');
      const member = await seedEmployee(pool, 'STAFF', 'member');
      const projectId = await seedProject(pool, actor.employeeId, 'Concurrent');
      const token = await tokenService.sign({ userId: actor.userId });
      const auth = { authorization: `Bearer ${token}` };
      const responses = await Promise.all([
        request(app).post(`/projects/${projectId}/members`).set(auth)
          .send({ employee_id: member.employeeId }),
        request(app).post(`/projects/${projectId}/members`).set(auth)
          .send({ employee_id: member.employeeId }),
      ]);
      assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
      assert.equal(
        responses.find((response) => response.status === 409)?.body.error.code,
        'PROJECT_MEMBER_ALREADY_EXISTS',
      );
      const [counts] = await pool.execute<CountRow[]>(
        `SELECT COUNT(*) AS count FROM project_members
         WHERE project_id = ? AND employee_id = ?`,
        [projectId, member.employeeId],
      );
      assert.equal(counts[0]?.count, '1');
    });

    await suite.test('delete protects lead and members with active tasks', async () => {
      await clearData(pool);
      const actor = await seedEmployee(pool, 'ADMIN', 'actor');
      const lead = await seedEmployee(pool, 'STAFF', 'lead');
      const member = await seedEmployee(pool, 'STAFF', 'member');
      const projectId = await seedProject(pool, lead.employeeId, 'Guards');
      await pool.execute(
        'INSERT INTO project_members (project_id, employee_id) VALUES (?, ?), (?, ?)',
        [projectId, lead.employeeId, projectId, member.employeeId],
      );
      const token = await tokenService.sign({ userId: actor.userId });
      const auth = { authorization: `Bearer ${token}` };

      const leadDelete = await request(app)
        .delete(`/projects/${projectId}/members/${lead.employeeId}`).set(auth);
      assert.equal(leadDelete.status, 409);
      assert.equal(leadDelete.body.error.code, 'PROJECT_LEAD_CANNOT_BE_REMOVED');

      const [task] = await pool.execute<ResultSetHeader>(
        `INSERT INTO tasks (nama_task, project_id, assigned_employee_id, status)
         VALUES (?, ?, ?, 'TODO')`,
        ['Active', projectId, member.employeeId],
      );
      const activeDelete = await request(app)
        .delete(`/projects/${projectId}/members/${member.employeeId}`).set(auth);
      assert.equal(activeDelete.status, 409);
      assert.equal(activeDelete.body.error.code, 'PROJECT_MEMBER_HAS_ACTIVE_TASKS');

      await pool.execute('UPDATE tasks SET status = ? WHERE task_id = ?', [
        'IN_PROGRESS', String(task.insertId),
      ]);
      const inProgressDelete = await request(app)
        .delete(`/projects/${projectId}/members/${member.employeeId}`).set(auth);
      assert.equal(inProgressDelete.status, 409);
      assert.equal(
        inProgressDelete.body.error.code,
        'PROJECT_MEMBER_HAS_ACTIVE_TASKS',
      );

      await pool.execute('UPDATE tasks SET status = ? WHERE task_id = ?', [
        'DONE', String(task.insertId),
      ]);
      const doneDelete = await request(app)
        .delete(`/projects/${projectId}/members/${member.employeeId}`).set(auth);
      assert.equal(doneDelete.status, 204);
      const [tasks] = await pool.execute<CountRow[]>(
        'SELECT COUNT(*) AS count FROM tasks WHERE task_id = ?',
        [String(task.insertId)],
      );
      assert.equal(tasks[0]?.count, '1');
    });
  } finally {
    await clearData(pool);
    await pool.end();
  }
});
