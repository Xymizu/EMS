import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise';

import {
  mapEmployee,
  type EmployeeRow,
} from '../employee/employee.repository.js';
import type {
  AddProjectMemberResult,
  ProjectMemberRepository,
  RemoveProjectMemberResult,
} from './project-member.types.js';

interface ExistingRow extends RowDataPacket { exists_value: number; }
interface ProjectRow extends RowDataPacket { lead_employee_id: string; }
interface DatabaseError extends Error { code?: string; }

const MEMBER_SELECT = `SELECT
  e.employee_id,
  u.user_id,
  u.nama,
  u.email,
  e.tanggal_masuk,
  e.role
FROM project_members AS pm
INNER JOIN employees AS e ON e.employee_id = pm.employee_id
INNER JOIN users AS u ON u.user_id = e.user_id`;

function isDuplicateError(error: unknown): boolean {
  return error instanceof Error &&
    (error as DatabaseError).code === 'ER_DUP_ENTRY';
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

export function createProjectMemberRepository(
  pool: Pool,
): ProjectMemberRepository {
  return {
    async findAll(projectId) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        if (!await projectExists(connection, projectId)) {
          await connection.rollback();
          return { status: 'project-not-found' };
        }
        const [rows] = await connection.execute<EmployeeRow[]>(
          `${MEMBER_SELECT}
           WHERE pm.project_id = ?
           ORDER BY e.employee_id ASC`,
          [projectId],
        );
        await connection.commit();
        return { status: 'ok', members: rows.map(mapEmployee) };
      } catch (error: unknown) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async add(projectId, employeeId) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        if (!await projectExists(connection, projectId)) {
          await connection.rollback();
          return { status: 'project-not-found' };
        }
        if (!await employeeExists(connection, employeeId)) {
          await connection.rollback();
          return { status: 'employee-not-found' };
        }
        try {
          await connection.execute<ResultSetHeader>(
            `INSERT INTO project_members (project_id, employee_id) VALUES (?, ?)`,
            [projectId, employeeId],
          );
        } catch (error: unknown) {
          if (isDuplicateError(error)) {
            await connection.rollback();
            return { status: 'already-exists' };
          }
          throw error;
        }
        const [rows] = await connection.execute<EmployeeRow[]>(
          `${MEMBER_SELECT}
           WHERE pm.project_id = ? AND pm.employee_id = ?
           LIMIT 1`,
          [projectId, employeeId],
        );
        const member = rows[0];
        if (!member) throw new Error('Created project member could not be loaded');
        await connection.commit();
        return { status: 'ok', member: mapEmployee(member) };
      } catch (error: unknown) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async remove(projectId, employeeId) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [projects] = await connection.execute<ProjectRow[]>(
          `SELECT CAST(lead_employee_id AS CHAR) AS lead_employee_id
           FROM projects WHERE project_id = ? FOR UPDATE`,
          [projectId],
        );
        const project = projects[0];
        if (!project) return await rollbackResult(
          connection,
          { status: 'project-not-found' },
        );
        if (!await employeeExists(connection, employeeId)) {
          return await rollbackResult(
            connection,
            { status: 'employee-not-found' },
          );
        }
        const [memberships] = await connection.execute<ExistingRow[]>(
          `SELECT 1 AS exists_value FROM project_members
           WHERE project_id = ? AND employee_id = ? FOR UPDATE`,
          [projectId, employeeId],
        );
        if (memberships.length === 0) return await rollbackResult(
          connection,
          { status: 'member-not-found' },
        );
        if (project.lead_employee_id === employeeId) return await rollbackResult(
          connection,
          { status: 'lead-cannot-be-removed' },
        );
        const [activeTasks] = await connection.execute<ExistingRow[]>(
          `SELECT 1 AS exists_value FROM tasks
           WHERE project_id = ?
             AND assigned_employee_id = ?
             AND status IN ('TODO', 'IN_PROGRESS')
           LIMIT 1 FOR UPDATE`,
          [projectId, employeeId],
        );
        if (activeTasks.length > 0) return await rollbackResult(
          connection,
          { status: 'has-active-tasks' },
        );
        await connection.execute<ResultSetHeader>(
          `DELETE FROM project_members WHERE project_id = ? AND employee_id = ?`,
          [projectId, employeeId],
        );
        await connection.commit();
        return { status: 'ok' };
      } catch (error: unknown) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}

async function rollbackResult<T extends AddProjectMemberResult | RemoveProjectMemberResult>(
  connection: PoolConnection,
  result: T,
): Promise<T> {
  await connection.rollback();
  return result;
}
