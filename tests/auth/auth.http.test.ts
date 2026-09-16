import assert from 'node:assert/strict';
import test from 'node:test';

import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import mysql, {
  type Pool,
  type ResultSetHeader,
} from 'mysql2/promise';
import request from 'supertest';

import { createApp } from '../../src/app.js';
import { getDatabaseConfig } from '../../src/config/database.js';
import type { JwtConfig } from '../../src/config/jwt.js';
import { executeMigration } from '../../src/database/migration.js';
import { createTokenService } from '../../src/modules/auth/token.service.js';

const jwtConfig: JwtConfig = {
  secret: 'http-integration-secret-with-at-least-32-characters',
  accessTokenTtlSeconds: 900,
  issuer: 'ems-api',
  audience: 'ems-client',
};

const validPassword = 'correct-password';
const passwordHash = bcrypt.hashSync(validPassword, 4);

interface SeededUser {
  userId: string;
  employeeId: string | null;
}

async function clearData(pool: Pool): Promise<void> {
  await pool.query('DELETE FROM tasks');
  await pool.query('DELETE FROM project_members');
  await pool.query('DELETE FROM projects');
  await pool.query('DELETE FROM employees');
  await pool.query('DELETE FROM users');
}

async function seedUser(
  pool: Pool,
  suffix: string,
  withEmployee = true,
): Promise<SeededUser> {
  const [userResult] = await pool.execute<ResultSetHeader>(
    'INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)',
    [`User ${suffix}`, `${suffix}@example.com`, passwordHash],
  );
  const userId = String(userResult.insertId);
  if (!withEmployee) {
    return { userId, employeeId: null };
  }

  const [employeeResult] = await pool.execute<ResultSetHeader>(
    'INSERT INTO employees (user_id, role, tanggal_masuk) VALUES (?, ?, ?)',
    [userId, 'STAFF', '2026-01-15'],
  );
  return { userId, employeeId: String(employeeResult.insertId) };
}

async function signSpecialToken(
  overrides: {
    subject?: string;
    secret?: string;
    issuer?: string;
    audience?: string;
    expiration?: number;
  } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  let builder = new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(overrides.issuer ?? jwtConfig.issuer)
    .setAudience(overrides.audience ?? jwtConfig.audience)
    .setIssuedAt(now)
    .setExpirationTime(overrides.expiration ?? now + 60);
  if (overrides.subject !== undefined) {
    builder = builder.setSubject(overrides.subject);
  }
  return builder.sign(
    new TextEncoder().encode(overrides.secret ?? jwtConfig.secret),
  );
}

test('authentication HTTP API', async (suite) => {
  await executeMigration('down', true);
  await executeMigration('up', true);
  const pool = mysql.createPool({
    ...getDatabaseConfig(true),
    connectionLimit: 2,
  });
  const app = createApp({ pool, jwtConfig });
  const tokenService = createTokenService(jwtConfig);

  suite.beforeEach(async () => {
    await clearData(pool);
  });

  try {
    await suite.test('login returns a valid access token', async () => {
      await clearData(pool);
      const seeded = await seedUser(pool, 'login');

      const response = await request(app).post('/auth/login').send({
        email: '  LOGIN@EXAMPLE.COM ',
        password: validPassword,
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.data.tokenType, 'Bearer');
      assert.equal(response.body.data.expiresIn, 900);
      assert.equal(typeof response.body.data.accessToken, 'string');
      assert.deepEqual(
        await tokenService.verify(response.body.data.accessToken),
        { userId: seeded.userId },
      );
      const serialized = JSON.stringify(response.body);
      assert.doesNotMatch(serialized, /password_hash|passwordHash|"password"/);
    });

    await suite.test('unknown email and wrong password return identical errors', async () => {
      await clearData(pool);
      await seedUser(pool, 'credentials');

      const unknownEmail = await request(app).post('/auth/login').send({
        email: 'missing@example.com',
        password: 'wrong-password',
      });
      const wrongPassword = await request(app).post('/auth/login').send({
        email: 'credentials@example.com',
        password: 'wrong-password',
      });

      const expectedBody = {
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      };
      assert.equal(unknownEmail.status, 401);
      assert.equal(wrongPassword.status, 401);
      assert.deepEqual(unknownEmail.body, expectedBody);
      assert.deepEqual(wrongPassword.body, expectedBody);
    });

    await suite.test('login rejects invalid and malformed payloads', async () => {
      const invalidPayloads: Array<Record<string, unknown> | unknown[]> = [
        {},
        [],
        { email: 'invalid', password: 'password' },
        { email: 'user@example.com', password: '' },
      ];
      for (const payload of invalidPayloads) {
        const response = await request(app).post('/auth/login').send(payload);
        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request' },
        });
      }

      const malformed = await request(app)
        .post('/auth/login')
        .set('content-type', 'application/json')
        .send('{"email":');
      assert.equal(malformed.status, 400);
      assert.deepEqual(malformed.body, {
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request' },
      });
    });

    await suite.test('/auth/me returns user and employee without password hash', async () => {
      await clearData(pool);
      const seeded = await seedUser(pool, 'current');
      const token = await tokenService.sign({ userId: seeded.userId });

      const response = await request(app)
        .get('/auth/me')
        .set('authorization', `Bearer ${token}`);

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, {
        data: {
          user: {
            userId: seeded.userId,
            nama: 'User current',
            email: 'current@example.com',
            employee: {
              employeeId: seeded.employeeId,
              role: 'STAFF',
              tanggalMasuk: '2026-01-15',
            },
          },
        },
      });
      assert.doesNotMatch(
        JSON.stringify(response.body),
        /password_hash|passwordHash|"password"/,
      );
    });

    await suite.test('/auth/me returns employee null when no employee exists', async () => {
      await clearData(pool);
      const seeded = await seedUser(pool, 'no-employee', false);
      const token = await tokenService.sign({ userId: seeded.userId });

      const response = await request(app)
        .get('/auth/me')
        .set('authorization', `Bearer ${token}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.data.user.employee, null);
    });

    await suite.test('protected routes reject every invalid credential generically', async () => {
      await clearData(pool);
      const seeded = await seedUser(pool, 'protected');
      const validToken = await tokenService.sign({ userId: seeded.userId });
      const now = Math.floor(Date.now() / 1000);
      const invalidHeaders: Array<string | undefined> = [
        undefined,
        'Basic abc',
        'Bearer',
        `Bearer ${validToken} extra`,
        'Bearer random-token',
        `Bearer ${await signSpecialToken({ subject: seeded.userId, secret: 'wrong-signing-secret-with-at-least-32-characters' })}`,
        `Bearer ${await signSpecialToken({ subject: seeded.userId, expiration: now - 1 })}`,
      ];

      for (const header of invalidHeaders) {
        let pendingRequest = request(app).get('/auth/me');
        if (header !== undefined) {
          pendingRequest = pendingRequest.set('authorization', header);
        }
        const response = await pendingRequest;
        assert.equal(response.status, 401);
        assert.deepEqual(response.body, {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }
    });

    await suite.test('token for a deleted user is unauthorized', async () => {
      await clearData(pool);
      const seeded = await seedUser(pool, 'deleted', false);
      const token = await tokenService.sign({ userId: seeded.userId });
      await pool.execute('DELETE FROM users WHERE user_id = ?', [seeded.userId]);

      const response = await request(app)
        .get('/auth/me')
        .set('authorization', `Bearer ${token}`);
      assert.equal(response.status, 401);
      assert.deepEqual(response.body, {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    });

    await suite.test('logout is protected and remains stateless', async () => {
      await clearData(pool);
      const seeded = await seedUser(pool, 'logout');
      const token = await tokenService.sign({ userId: seeded.userId });

      const unauthorized = await request(app).post('/auth/logout');
      assert.equal(unauthorized.status, 401);

      const logout = await request(app)
        .post('/auth/logout')
        .set('authorization', `Bearer ${token}`);
      assert.equal(logout.status, 200);
      assert.deepEqual(logout.body, {
        data: { message: 'Logout successful' },
      });

      const stillValid = await request(app)
        .get('/auth/me')
        .set('authorization', `Bearer ${token}`);
      assert.equal(stillValid.status, 200);
    });
  } finally {
    await clearData(pool);
    await pool.end();
  }
});
