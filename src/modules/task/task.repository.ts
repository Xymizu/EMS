import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise';

import { mapEmployee, type EmployeeRow } from '../employee/employee.repository.js';
import type { EmployeeRole } from '../employee/employee.types.js';
import {
  canTransitionTaskStatus,
  canUpdateTaskStatus,
} from './task-status.policy.js';
import type {
  CreateTaskResult,
  TaskRepository,
  TaskResponse,
  TaskStatus,
  UpdateTaskResult,
  UpdateTaskStatusResult,
  ProjectTaskAccess,
} from './task.types.js';

interface TaskRow extends EmployeeRow {
  task_id: string;
  nama_task: string;
  status: TaskStatus;
  project_id: string;
  nama_project: string;
}

interface ExistingRow extends RowDataPacket { exists_value: number; }
interface ProjectIdRow extends RowDataPacket { project_id: string; }
interface IdRow extends RowDataPacket { id: string; }
interface StatusProjectRow extends RowDataPacket { lead_employee_id: string; }
interface StatusTaskRow extends RowDataPacket {
  project_id: string;
  assigned_employee_id: string;
  status: TaskStatus;
}
interface ActorRow extends RowDataPacket {
  employee_id: string;
  role: EmployeeRole;
}
interface ProjectAccessRow extends RowDataPacket {
  actor_employee_id: string | null;
  is_lead: number;
  is_member: number;
}

const TASK_SELECT = `SELECT
  t.task_id,
  t.nama_task,
  t.status,
  p.project_id,
  p.nama_project,
  e.employee_id,
  u.user_id,
  u.nama,
  u.email,
  e.tanggal_masuk,
  e.role
FROM tasks AS t
INNER JOIN projects AS p ON p.project_id = t.project_id
INNER JOIN employees AS e ON e.employee_id = t.assigned_employee_id
INNER JOIN users AS u ON u.user_id = e.user_id`;

function mapTask(row: TaskRow): TaskResponse {
  return {
    taskId: row.task_id,
    namaTask: row.nama_task,
    status: row.status,
    project: {
      projectId: row.project_id,
      namaProject: row.nama_project,
    },
    assignee: mapEmployee(row),
  };
}

async function projectExists(
  connection: PoolConnection,
  projectId: string,
): Promise<boolean> {
  const [rows] = await connection.execute<ExistingRow[]>(
    `SELECT 1 AS exists_value FROM projects
     WHERE project_id = ? LOCK IN SHARE MODE`,
    [projectId],
  );
  return rows.length > 0;
}

async function employeeExists(
  connection: PoolConnection,
  employeeId: string,
): Promise<boolean> {
  const [rows] = await connection.execute<ExistingRow[]>(
    `SELECT 1 AS exists_value FROM employees
     WHERE employee_id = ? LOCK IN SHARE MODE`,
    [employeeId],
  );
  return rows.length > 0;
}

async function membershipExists(
  connection: PoolConnection,
  projectId: string,
  employeeId: string,
): Promise<boolean> {
  const [rows] = await connection.execute<ExistingRow[]>(
    `SELECT 1 AS exists_value FROM project_members
     WHERE project_id = ? AND employee_id = ? LOCK IN SHARE MODE`,
    [projectId, employeeId],
  );
  return rows.length > 0;
}

async function loadTask(
  connection: PoolConnection,
  taskId: string,
): Promise<TaskResponse> {
  const [rows] = await connection.execute<TaskRow[]>(
    `${TASK_SELECT} WHERE t.task_id = ? LIMIT 1`,
    [taskId],
  );
  const row = rows[0];
  if (!row) throw new Error('Task could not be loaded');
  return mapTask(row);
}

async function rollbackResult<
  T extends CreateTaskResult | UpdateTaskResult | UpdateTaskStatusResult,
>(
  connection: PoolConnection,
  result: T,
): Promise<T> {
  await connection.rollback();
  return result;
}

export function createTaskRepository(pool: Pool): TaskRepository {
  return {
    async findProjectAccess(actorUserId, projectId): Promise<ProjectTaskAccess> {
      const [rows] = await pool.execute<ProjectAccessRow[]>(
        `SELECT
           CAST(actor.employee_id AS CHAR) AS actor_employee_id,
           (p.lead_employee_id = actor.employee_id) AS is_lead,
           EXISTS(
             SELECT 1 FROM project_members AS pm
             WHERE pm.project_id = p.project_id
               AND pm.employee_id = actor.employee_id
           ) AS is_member
         FROM projects AS p
         LEFT JOIN employees AS actor ON actor.user_id = ?
         WHERE p.project_id = ?
         LIMIT 1`,
        [actorUserId, projectId],
      );
      const row = rows[0];
      if (!row) {
        return {
          projectExists: false,
          actorEmployeeId: null,
          isLead: false,
          isMember: false,
        };
      }
      return {
        projectExists: true,
        actorEmployeeId: row.actor_employee_id,
        isLead: Boolean(row.is_lead),
        isMember: Boolean(row.is_member),
      };
    },

    async create(projectId, input) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        if (!await projectExists(connection, projectId)) {
          return await rollbackResult(connection, { status: 'project-not-found' });
        }
        if (!await employeeExists(connection, input.assignedEmployeeId)) {
          return await rollbackResult(connection, { status: 'employee-not-found' });
        }
        if (!await membershipExists(connection, projectId, input.assignedEmployeeId)) {
          return await rollbackResult(
            connection,
            { status: 'assignee-not-project-member' },
          );
        }
        await connection.execute<ResultSetHeader>(
          `INSERT INTO tasks (nama_task, project_id, assigned_employee_id)
           VALUES (?, ?, ?)`,
          [input.namaTask, projectId, input.assignedEmployeeId],
        );
        const [idRows] = await connection.query<IdRow[]>(
          `SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id`,
        );
        const taskId = idRows[0]?.id;
        if (!taskId) throw new Error('Created task ID was not returned');
        const task = await loadTask(connection, taskId);
        await connection.commit();
        return { status: 'ok', task };
      } catch (error: unknown) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async findAllByProjectId(projectId, pagination, assignedEmployeeId) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        if (!await projectExists(connection, projectId)) {
          await connection.rollback();
          return { status: 'project-not-found' };
        }
        const assigneeFilter = assignedEmployeeId === undefined
          ? ''
          : ' AND t.assigned_employee_id = ?';
        const parameters = assignedEmployeeId === undefined
          ? [projectId]
          : [projectId, assignedEmployeeId];
        const [rows] = await connection.execute<TaskRow[]>(
          `${TASK_SELECT}
           WHERE t.project_id = ?${assigneeFilter}
           ORDER BY t.task_id ASC
           LIMIT ? OFFSET ?`,
          [...parameters, pagination.limit, pagination.offset],
        );
        await connection.commit();
        return { status: 'ok', tasks: rows.map(mapTask) };
      } catch (error: unknown) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async findById(taskId) {
      const [rows] = await pool.execute<TaskRow[]>(
        `${TASK_SELECT} WHERE t.task_id = ? LIMIT 1`,
        [taskId],
      );
      return rows[0] ? mapTask(rows[0]) : null;
    },

    async update(taskId, input) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [initialRows] = await connection.execute<ProjectIdRow[]>(
          `SELECT CAST(project_id AS CHAR) AS project_id
           FROM tasks WHERE task_id = ? LIMIT 1`,
          [taskId],
        );
        const initial = initialRows[0];
        if (!initial) {
          return await rollbackResult(connection, { status: 'task-not-found' });
        }
        const [projectRows] = await connection.execute<ExistingRow[]>(
          `SELECT 1 AS exists_value FROM projects
           WHERE project_id = ? FOR UPDATE`,
          [initial.project_id],
        );
        if (projectRows.length === 0) {
          throw new Error('Task project could not be loaded');
        }
        const [taskRows] = await connection.execute<ProjectIdRow[]>(
          `SELECT CAST(project_id AS CHAR) AS project_id
           FROM tasks WHERE task_id = ? FOR UPDATE`,
          [taskId],
        );
        const target = taskRows[0];
        if (!target) {
          return await rollbackResult(connection, { status: 'task-not-found' });
        }
        if (input.assignedEmployeeId !== undefined) {
          if (!await employeeExists(connection, input.assignedEmployeeId)) {
            return await rollbackResult(connection, { status: 'employee-not-found' });
          }
          if (!await membershipExists(
            connection,
            target.project_id,
            input.assignedEmployeeId,
          )) {
            return await rollbackResult(
              connection,
              { status: 'assignee-not-project-member' },
            );
          }
        }
        const clauses: string[] = [];
        const values: string[] = [];
        if (input.namaTask !== undefined) {
          clauses.push('nama_task = ?');
          values.push(input.namaTask);
        }
        if (input.assignedEmployeeId !== undefined) {
          clauses.push('assigned_employee_id = ?');
          values.push(input.assignedEmployeeId);
        }
        await connection.execute<ResultSetHeader>(
          `UPDATE tasks SET ${clauses.join(', ')} WHERE task_id = ?`,
          [...values, taskId],
        );
        const task = await loadTask(connection, taskId);
        await connection.commit();
        return { status: 'ok', task };
      } catch (error: unknown) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async updateStatus(actorUserId, taskId, targetStatus) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [initialRows] = await connection.execute<ProjectIdRow[]>(
          `SELECT CAST(project_id AS CHAR) AS project_id
           FROM tasks WHERE task_id = ? LIMIT 1`,
          [taskId],
        );
        const initial = initialRows[0];
        if (!initial) {
          return await rollbackResult(connection, { status: 'task-not-found' });
        }
        const [projectRows] = await connection.execute<StatusProjectRow[]>(
          `SELECT CAST(lead_employee_id AS CHAR) AS lead_employee_id
           FROM projects WHERE project_id = ? FOR UPDATE`,
          [initial.project_id],
        );
        const project = projectRows[0];
        if (!project) {
          return await rollbackResult(connection, { status: 'task-not-found' });
        }
        const [taskRows] = await connection.execute<StatusTaskRow[]>(
          `SELECT
             CAST(project_id AS CHAR) AS project_id,
             CAST(assigned_employee_id AS CHAR) AS assigned_employee_id,
             status
           FROM tasks WHERE task_id = ? FOR UPDATE`,
          [taskId],
        );
        const target = taskRows[0];
        if (!target) {
          return await rollbackResult(connection, { status: 'task-not-found' });
        }
        const [actorRows] = await connection.execute<ActorRow[]>(
          `SELECT
             CAST(employee_id AS CHAR) AS employee_id,
             role
           FROM employees WHERE user_id = ? LOCK IN SHARE MODE`,
          [actorUserId],
        );
        const actor = actorRows[0];
        if (!actor) {
          return await rollbackResult(connection, { status: 'actor-not-employee' });
        }
        if (!canUpdateTaskStatus({
          actorEmployeeId: actor.employee_id,
          actorRole: actor.role,
          assignedEmployeeId: target.assigned_employee_id,
          leadEmployeeId: project.lead_employee_id,
        })) {
          return await rollbackResult(connection, { status: 'forbidden' });
        }
        if (!canTransitionTaskStatus(target.status, targetStatus)) {
          return await rollbackResult(connection, { status: 'invalid-transition' });
        }
        await connection.execute<ResultSetHeader>(
          `UPDATE tasks SET status = ? WHERE task_id = ?`,
          [targetStatus, taskId],
        );
        const task = await loadTask(connection, taskId);
        await connection.commit();
        return { status: 'ok', task };
      } catch (error: unknown) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async delete(taskId) {
      const [result] = await pool.execute<ResultSetHeader>(
        `DELETE FROM tasks WHERE task_id = ?`,
        [taskId],
      );
      return result.affectedRows > 0;
    },
  };
}
