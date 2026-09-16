import type { Pool, RowDataPacket } from 'mysql2/promise';

import type {
  AuthRepository,
  CurrentUserResponse,
  LoginUserRecord,
} from './auth.types.js';

interface LoginUserRow extends RowDataPacket {
  user_id: string;
  email: string;
  password_hash: string;
}

interface CurrentUserRow extends RowDataPacket {
  user_id: string;
  nama: string;
  email: string;
  employee_id: string | null;
  role: string | null;
  tanggal_masuk: string | null;
}

export function createAuthRepository(pool: Pool): AuthRepository {
  return {
    async findForLoginByEmail(email: string): Promise<LoginUserRecord | null> {
      const [rows] = await pool.execute<LoginUserRow[]>(
        `SELECT user_id, email, password_hash
           FROM users
          WHERE email = ?
          LIMIT 1`,
        [email],
      );
      const user = rows[0];
      if (!user) {
        return null;
      }

      return {
        userId: user.user_id,
        email: user.email,
        passwordHash: user.password_hash,
      };
    },

    async findCurrentUserById(
      userId: string,
    ): Promise<CurrentUserResponse | null> {
      const [rows] = await pool.execute<CurrentUserRow[]>(
        `SELECT
           u.user_id,
           u.nama,
           u.email,
           e.employee_id,
           e.role,
           e.tanggal_masuk
         FROM users AS u
         LEFT JOIN employees AS e ON e.user_id = u.user_id
         WHERE u.user_id = ?
         LIMIT 1`,
        [userId],
      );
      const user = rows[0];
      if (!user) {
        return null;
      }

      return {
        userId: user.user_id,
        nama: user.nama,
        email: user.email,
        employee:
          user.employee_id === null
            ? null
            : {
                employeeId: user.employee_id,
                role: user.role ?? '',
                tanggalMasuk: user.tanggal_masuk ?? '',
              },
      };
    },
  };
}
