import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise';

import { ProjectHasDependenciesError } from './project.errors.js';
import type {
  ProjectRepository,
  ProjectResponse,
} from './project.types.js';
import type { EmployeeRole } from '../employee/employee.types.js';

interface ProjectRow extends RowDataPacket {
  project_id: string;
  nama_project: string;
  employee_id: string;
  user_id: string;
  nama: string;
  email: string;
  tanggal_masuk: string;
  role: EmployeeRole;
}

interface IdRow extends RowDataPacket { id: string; }
interface ExistingRow extends RowDataPacket { exists_value: number; }
interface DatabaseError extends Error { code?: string; }

const PROJECT_SELECT = `SELECT
  p.project_id,
  p.nama_project,
  e.employee_id,
  u.user_id,
  u.nama,
  u.email,
  e.tanggal_masuk,
  e.role
FROM projects AS p
INNER JOIN employees AS e ON e.employee_id = p.lead_employee_id
INNER JOIN users AS u ON u.user_id = e.user_id`;

function mapProject(row: ProjectRow): ProjectResponse {
  return {
    projectId: row.project_id,
    namaProject: row.nama_project,
    lead: {
      employeeId: row.employee_id,
      userId: row.user_id,
      nama: row.nama,
      email: row.email,
      tanggalMasuk: row.tanggal_masuk,
      role: row.role,
    },
  };
}

async function employeeExists(
  connection: PoolConnection,
  employeeId: string,
): Promise<boolean> {
  const [rows] = await connection.execute<ExistingRow[]>(
    `SELECT 1 AS exists_value FROM employees WHERE employee_id = ? LOCK IN SHARE MODE`,
    [employeeId],
  );
  return rows.length > 0;
}

function isReferencedError(error: unknown): boolean {
  return error instanceof Error &&
    (error as DatabaseError).code === 'ER_ROW_IS_REFERENCED_2';
}

export function createProjectRepository(pool: Pool): ProjectRepository {
  return {
    async create(input) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        if (!await employeeExists(connection, input.leadEmployeeId)) {
          await connection.rollback();
          return null;
        }
        await connection.execute<ResultSetHeader>(
          `INSERT INTO projects (nama_project, lead_employee_id) VALUES (?, ?)`,
          [input.namaProject, input.leadEmployeeId],
        );
        const [idRows] = await connection.query<IdRow[]>(
          `SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id`,
        );
        const projectId = idRows[0]?.id;
        if (!projectId) throw new Error('Created project ID was not returned');
        const [rows] = await connection.execute<ProjectRow[]>(
          `${PROJECT_SELECT} WHERE p.project_id = ? LIMIT 1`,
          [projectId],
        );
        const project = rows[0];
        if (!project) throw new Error('Created project could not be loaded');
        await connection.commit();
        return mapProject(project);
      } catch (error: unknown) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async findAll(pagination) {
      const [rows] = await pool.query<ProjectRow[]>(
        `${PROJECT_SELECT} ORDER BY p.project_id ASC LIMIT ? OFFSET ?`,
        [pagination.limit, pagination.offset],
      );
      return rows.map(mapProject);
    },

    async findAllAccessibleByUserId(userId, pagination) {
      const [rows] = await pool.execute<ProjectRow[]>(
        `${PROJECT_SELECT}
         WHERE e.user_id = ?
            OR EXISTS (
              SELECT 1
              FROM project_members AS pm
              INNER JOIN employees AS actor ON actor.employee_id = pm.employee_id
              WHERE pm.project_id = p.project_id AND actor.user_id = ?
            )
         ORDER BY p.project_id ASC
         LIMIT ? OFFSET ?`,
        [userId, userId, pagination.limit, pagination.offset],
      );
      return rows.map(mapProject);
    },

    async findById(projectId) {
      const [rows] = await pool.execute<ProjectRow[]>(
        `${PROJECT_SELECT} WHERE p.project_id = ? LIMIT 1`,
        [projectId],
      );
      return rows[0] ? mapProject(rows[0]) : null;
    },

    async findAccessibleById(userId, projectId) {
      const [rows] = await pool.execute<ProjectRow[]>(
        `${PROJECT_SELECT}
         WHERE p.project_id = ?
           AND (
             e.user_id = ?
             OR EXISTS (
               SELECT 1
               FROM project_members AS pm
               INNER JOIN employees AS actor ON actor.employee_id = pm.employee_id
               WHERE pm.project_id = p.project_id AND actor.user_id = ?
             )
           )
         LIMIT 1`,
        [projectId, userId, userId],
      );
      return rows[0] ? mapProject(rows[0]) : null;
    },

    async update(projectId, input) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [targets] = await connection.execute<ExistingRow[]>(
          `SELECT 1 AS exists_value FROM projects WHERE project_id = ? FOR UPDATE`,
          [projectId],
        );
        if (targets.length === 0) {
          await connection.rollback();
          return null;
        }
        if (
          input.leadEmployeeId !== undefined &&
          !await employeeExists(connection, input.leadEmployeeId)
        ) {
          await connection.rollback();
          return 'LEAD_NOT_FOUND';
        }

        const clauses: string[] = [];
        const values: string[] = [];
        if (input.namaProject !== undefined) {
          clauses.push('nama_project = ?');
          values.push(input.namaProject);
        }
        if (input.leadEmployeeId !== undefined) {
          clauses.push('lead_employee_id = ?');
          values.push(input.leadEmployeeId);
        }
        await connection.execute(
          `UPDATE projects SET ${clauses.join(', ')} WHERE project_id = ?`,
          [...values, projectId],
        );
        const [rows] = await connection.execute<ProjectRow[]>(
          `${PROJECT_SELECT} WHERE p.project_id = ? LIMIT 1`,
          [projectId],
        );
        const project = rows[0];
        if (!project) throw new Error('Updated project could not be loaded');
        await connection.commit();
        return mapProject(project);
      } catch (error: unknown) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async delete(projectId) {
      try {
        const [result] = await pool.execute<ResultSetHeader>(
          `DELETE FROM projects WHERE project_id = ?`,
          [projectId],
        );
        return result.affectedRows > 0;
      } catch (error: unknown) {
        if (isReferencedError(error)) throw new ProjectHasDependenciesError();
        throw error;
      }
    },
  };
}
