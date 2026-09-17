import type {
  Pool,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise';

import { EmailAlreadyExistsError } from './employee.errors.js';
import type {
  EmployeeRepository,
  EmployeeResponse,
  EmployeeRole,
} from './employee.types.js';

export interface EmployeeRow extends RowDataPacket {
  employee_id: string;
  user_id: string;
  nama: string;
  email: string;
  tanggal_masuk: string;
  role: EmployeeRole;
}

interface RoleRow extends RowDataPacket {
  role: EmployeeRole;
}

interface IdRow extends RowDataPacket {
  id: string;
}

interface TargetRow extends RowDataPacket {
  user_id: string;
}

interface DatabaseError extends Error {
  code?: string;
  sqlMessage?: string;
}

const EMPLOYEE_SELECT = `SELECT
  e.employee_id,
  u.user_id,
  u.nama,
  u.email,
  e.tanggal_masuk,
  e.role
FROM employees AS e
INNER JOIN users AS u ON u.user_id = e.user_id`;

export function mapEmployee(row: EmployeeRow): EmployeeResponse {
  return {
    employeeId: row.employee_id,
    userId: row.user_id,
    nama: row.nama,
    email: row.email,
    tanggalMasuk: row.tanggal_masuk,
    role: row.role,
  };
}

function isEmailDuplicate(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const databaseError = error as DatabaseError;
  return (
    databaseError.code === 'ER_DUP_ENTRY' &&
    (databaseError.sqlMessage ?? databaseError.message).includes('uq_users_email')
  );
}

export function createEmployeeRepository(pool: Pool): EmployeeRepository {
  return {
    async findActorRoleByUserId(userId) {
      const [rows] = await pool.execute<RoleRow[]>(
        `SELECT role FROM employees WHERE user_id = ? LIMIT 1`,
        [userId],
      );
      return rows[0]?.role ?? null;
    },

    async create(input) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.execute<ResultSetHeader>(
          `INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)`,
          [input.nama, input.email, input.passwordHash],
        );
        const [userIdRows] = await connection.query<IdRow[]>(
          `SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id`,
        );
        const userId = userIdRows[0]?.id;
        if (!userId) throw new Error('Created user ID was not returned');

        await connection.execute<ResultSetHeader>(
          `INSERT INTO employees (user_id, role, tanggal_masuk) VALUES (?, ?, ?)`,
          [userId, input.role, input.tanggalMasuk],
        );
        const [employeeIdRows] = await connection.query<IdRow[]>(
          `SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id`,
        );
        const employeeId = employeeIdRows[0]?.id;
        if (!employeeId) throw new Error('Created employee ID was not returned');

        const employee: EmployeeResponse = {
          employeeId,
          userId,
          nama: input.nama,
          email: input.email,
          tanggalMasuk: input.tanggalMasuk,
          role: input.role,
        };
        await connection.commit();
        return employee;
      } catch (error: unknown) {
        await connection.rollback();
        if (isEmailDuplicate(error)) throw new EmailAlreadyExistsError();
        throw error;
      } finally {
        connection.release();
      }
    },

    async findAll(pagination) {
      const [rows] = await pool.query<EmployeeRow[]>(
        `${EMPLOYEE_SELECT} ORDER BY e.employee_id ASC LIMIT ? OFFSET ?`,
        [pagination.limit, pagination.offset],
      );
      return rows.map(mapEmployee);
    },

    async findById(employeeId) {
      const [rows] = await pool.execute<EmployeeRow[]>(
        `${EMPLOYEE_SELECT} WHERE e.employee_id = ? LIMIT 1`,
        [employeeId],
      );
      return rows[0] ? mapEmployee(rows[0]) : null;
    },

    async update(employeeId, input) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [targets] = await connection.execute<TargetRow[]>(
          `SELECT user_id FROM employees WHERE employee_id = ? FOR UPDATE`,
          [employeeId],
        );
        const target = targets[0];
        if (!target) {
          await connection.rollback();
          return null;
        }

        const userClauses: string[] = [];
        const userValues: string[] = [];
        if (input.nama !== undefined) {
          userClauses.push('nama = ?');
          userValues.push(input.nama);
        }
        if (input.email !== undefined) {
          userClauses.push('email = ?');
          userValues.push(input.email);
        }
        if (input.passwordHash !== undefined) {
          userClauses.push('password_hash = ?');
          userValues.push(input.passwordHash);
        }
        if (userClauses.length > 0) {
          await connection.execute(
            `UPDATE users SET ${userClauses.join(', ')} WHERE user_id = ?`,
            [...userValues, target.user_id],
          );
        }

        const employeeClauses: string[] = [];
        const employeeValues: string[] = [];
        if (input.tanggalMasuk !== undefined) {
          employeeClauses.push('tanggal_masuk = ?');
          employeeValues.push(input.tanggalMasuk);
        }
        if (input.role !== undefined) {
          employeeClauses.push('role = ?');
          employeeValues.push(input.role);
        }
        if (employeeClauses.length > 0) {
          await connection.execute(
            `UPDATE employees SET ${employeeClauses.join(', ')} WHERE employee_id = ?`,
            [...employeeValues, employeeId],
          );
        }

        const [rows] = await connection.execute<EmployeeRow[]>(
          `${EMPLOYEE_SELECT} WHERE e.employee_id = ? LIMIT 1`,
          [employeeId],
        );
        const employee = rows[0];
        if (!employee) throw new Error('Updated employee could not be loaded');
        await connection.commit();
        return mapEmployee(employee);
      } catch (error: unknown) {
        await connection.rollback();
        if (isEmailDuplicate(error)) throw new EmailAlreadyExistsError();
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}
