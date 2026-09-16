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
  secret: 'task-http-secret-with-at-least-32-characters',
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

async function seedProject(pool: Pool, leadId: string, name: string): Promise<string> {
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO projects (nama_project, lead_employee_id) VALUES (?, ?)',
    [name, leadId],
  );
  return String(result.insertId);
}

async function addMember(pool: Pool, projectId: string, employeeId: string): Promise<void> {
  await pool.execute(
    'INSERT INTO project_members (project_id, employee_id) VALUES (?, ?)',
    [projectId, employeeId],
  );
}

test('task management HTTP API', async (suite) => {
  await executeMigration('down', true);
  await executeMigration('up', true);
  const pool = mysql.createPool({ ...getDatabaseConfig(true), connectionLimit: 6 });
  const app = createApp({ pool, jwtConfig, passwordHashRounds: 4 });
  const tokenService = createTokenService(jwtConfig);

  try {
    await suite.test('all endpoints require authentication', async () => {
      const responses = await Promise.all([
        request(app).post('/projects/1/tasks').send({
          nama_task: 'Task', assigned_employee_id: '2',
        }),
        request(app).get('/projects/1/tasks'),
        request(app).get('/tasks/1'),
        request(app).patch('/tasks/1').send({ nama_task: 'New' }),
        request(app).delete('/tasks/1'),
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
        request(app).post('/projects/999/tasks').set(auth)
          .send({ nama_task: 'Task', assigned_employee_id: '999' }),
        request(app).get('/projects/999/tasks').set(auth),
        request(app).get('/tasks/999').set(auth),
        request(app).patch('/tasks/999').set(auth).send({ nama_task: 'New' }),
        request(app).delete('/tasks/999').set(auth),
      ]);
      for (const response of responses) {
        assert.equal(response.status, 403);
        assert.equal(response.body.error.code, 'FORBIDDEN');
      }
    });

    await suite.test('Admin performs create, list, detail, patch, and delete', async () => {
      await clearData(pool);
      const actor = await seedEmployee(pool, 'ADMIN', 'actor');
      const first = await seedEmployee(pool, 'STAFF', 'first');
      const second = await seedEmployee(pool, 'SUPER_ADMIN', 'second');
      const projectId = await seedProject(pool, actor.employeeId, 'Website');
      const otherProject = await seedProject(pool, actor.employeeId, 'Other');
      await addMember(pool, projectId, first.employeeId);
      await addMember(pool, projectId, second.employeeId);
      await addMember(pool, otherProject, first.employeeId);
      const token = await tokenService.sign({ userId: actor.userId });
      const auth = { authorization: `Bearer ${token}` };

      const empty = await request(app).get(`/projects/${projectId}/tasks`).set(auth);
      assert.equal(empty.status, 200);
      assert.deepEqual(empty.body, { data: { projectId, tasks: [] } });

      const firstTask = await request(app).post(`/projects/${projectId}/tasks`)
        .set(auth).send({
          nama_task: '  Login page  ', assigned_employee_id: first.employeeId,
        });
      const secondTask = await request(app).post(`/projects/${projectId}/tasks`)
        .set(auth).send({
          nama_task: 'Dashboard', assigned_employee_id: second.employeeId,
        });
      await request(app).post(`/projects/${otherProject}/tasks`).set(auth).send({
        nama_task: 'Other task', assigned_employee_id: first.employeeId,
      });
      assert.equal(firstTask.status, 201);
      assert.equal(secondTask.status, 201);
      assert.equal(firstTask.body.data.task.namaTask, 'Login page');
      assert.equal(firstTask.body.data.task.status, 'TODO');
      assert.equal(firstTask.body.data.task.project.projectId, projectId);
      assert.equal(firstTask.body.data.task.assignee.employeeId, first.employeeId);
      assert.doesNotMatch(JSON.stringify(firstTask.body), /password/i);
      const taskId: string = firstTask.body.data.task.taskId;

      const list = await request(app).get(`/projects/${projectId}/tasks`).set(auth);
      assert.equal(list.status, 200);
      assert.deepEqual(
        list.body.data.tasks.map((item: { taskId: string }) => item.taskId),
        [taskId, secondTask.body.data.task.taskId],
      );

      const detail = await request(app).get(`/tasks/${taskId}`).set(auth);
      assert.deepEqual(detail.body.data.task, firstTask.body.data.task);

      const updated = await request(app).patch(`/tasks/${taskId}`).set(auth).send({
        nama_task: 'Responsive login', assigned_employee_id: second.employeeId,
      });
      assert.equal(updated.status, 200);
      assert.equal(updated.body.data.task.namaTask, 'Responsive login');
      assert.equal(updated.body.data.task.assignee.employeeId, second.employeeId);
      assert.equal(updated.body.data.task.project.projectId, projectId);
      assert.equal(updated.body.data.task.status, 'TODO');

      const removed = await request(app).delete(`/tasks/${taskId}`).set(auth);
      assert.equal(removed.status, 204);
      assert.equal(removed.text, '');
      const missing = await request(app).get(`/tasks/${taskId}`).set(auth);
      assert.equal(missing.status, 404);
      assert.equal(missing.body.error.code, 'TASK_NOT_FOUND');

      const [members] = await pool.execute<CountRow[]>(
        'SELECT COUNT(*) AS count FROM project_members WHERE project_id = ?',
        [projectId],
      );
      assert.equal(members[0]?.count, '2');
    });

    await suite.test('Super Admin receives stable validation and target errors', async () => {
      await clearData(pool);
      const actor = await seedEmployee(pool, 'SUPER_ADMIN', 'actor');
      const member = await seedEmployee(pool, 'STAFF', 'member');
      const outsider = await seedEmployee(pool, 'STAFF', 'outsider');
      const projectId = await seedProject(pool, actor.employeeId, 'Errors');
      await addMember(pool, projectId, member.employeeId);
      const token = await tokenService.sign({ userId: actor.userId });
      const auth = { authorization: `Bearer ${token}` };

      const invalid = await request(app).post(`/projects/${projectId}/tasks`)
        .set(auth).send({
          nama_task: 'Task', assigned_employee_id: member.employeeId, status: 'DONE',
        });
      assert.equal(invalid.status, 400);
      const missingProject = await request(app).post('/projects/999999/tasks')
        .set(auth).send({ nama_task: 'Task', assigned_employee_id: '999999' });
      assert.equal(missingProject.body.error.code, 'PROJECT_NOT_FOUND');
      const missingEmployee = await request(app).post(`/projects/${projectId}/tasks`)
        .set(auth).send({ nama_task: 'Task', assigned_employee_id: '999999' });
      assert.equal(missingEmployee.body.error.code, 'EMPLOYEE_NOT_FOUND');
      const outsiderResponse = await request(app).post(`/projects/${projectId}/tasks`)
        .set(auth).send({ nama_task: 'Task', assigned_employee_id: outsider.employeeId });
      assert.equal(outsiderResponse.status, 400);
      assert.equal(outsiderResponse.body.error.code, 'ASSIGNEE_NOT_PROJECT_MEMBER');
      const missingTask = await request(app).get('/tasks/999999').set(auth);
      assert.equal(missingTask.body.error.code, 'TASK_NOT_FOUND');
    });

    await suite.test('failed assignee patch rolls back every field', async () => {
      await clearData(pool);
      const actor = await seedEmployee(pool, 'ADMIN', 'actor');
      const member = await seedEmployee(pool, 'STAFF', 'member');
      const outsider = await seedEmployee(pool, 'STAFF', 'outsider');
      const projectId = await seedProject(pool, actor.employeeId, 'Rollback');
      await addMember(pool, projectId, member.employeeId);
      const token = await tokenService.sign({ userId: actor.userId });
      const auth = { authorization: `Bearer ${token}` };
      const created = await request(app).post(`/projects/${projectId}/tasks`)
        .set(auth).send({ nama_task: 'Original', assigned_employee_id: member.employeeId });
      const taskId: string = created.body.data.task.taskId;
      const invalidBody = await request(app).patch(`/tasks/${taskId}`).set(auth)
        .send({ status: 'DONE' });
      assert.equal(invalidBody.status, 400);
      const failed = await request(app).patch(`/tasks/${taskId}`).set(auth).send({
        nama_task: 'Must rollback', assigned_employee_id: outsider.employeeId,
      });
      assert.equal(failed.status, 400);
      assert.equal(failed.body.error.code, 'ASSIGNEE_NOT_PROJECT_MEMBER');
      const detail = await request(app).get(`/tasks/${taskId}`).set(auth);
      assert.equal(detail.body.data.task.namaTask, 'Original');
      assert.equal(detail.body.data.task.assignee.employeeId, member.employeeId);
      assert.equal(detail.body.data.task.status, 'TODO');
    });

    await suite.test('assignment and member removal preserve membership invariant', async () => {
      await clearData(pool);
      const actor = await seedEmployee(pool, 'ADMIN', 'actor');
      const lead = await seedEmployee(pool, 'STAFF', 'lead');
      const member = await seedEmployee(pool, 'STAFF', 'member');
      const projectId = await seedProject(pool, lead.employeeId, 'Concurrent');
      await addMember(pool, projectId, member.employeeId);
      const token = await tokenService.sign({ userId: actor.userId });
      const auth = { authorization: `Bearer ${token}` };

      const [assignment, removal] = await Promise.all([
        request(app).post(`/projects/${projectId}/tasks`).set(auth).send({
          nama_task: 'Concurrent', assigned_employee_id: member.employeeId,
        }),
        request(app).delete(`/projects/${projectId}/members/${member.employeeId}`).set(auth),
      ]);
      assert.ok(
        (assignment.status === 201 && removal.status === 409) ||
        (assignment.status === 400 && removal.status === 204),
      );
      const [taskCounts] = await pool.execute<CountRow[]>(
        `SELECT COUNT(*) AS count FROM tasks
         WHERE project_id = ? AND assigned_employee_id = ?`,
        [projectId, member.employeeId],
      );
      const [memberCounts] = await pool.execute<CountRow[]>(
        `SELECT COUNT(*) AS count FROM project_members
         WHERE project_id = ? AND employee_id = ?`,
        [projectId, member.employeeId],
      );
      assert.equal(taskCounts[0]?.count, memberCounts[0]?.count);
    });
  } finally {
    await clearData(pool);
    await pool.end();
  }
});
