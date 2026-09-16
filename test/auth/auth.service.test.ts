import assert from 'node:assert/strict';
import test from 'node:test';

import {
  InvalidCredentialsError,
  UnauthorizedError,
} from '../../src/modules/auth/auth.errors.js';
import { createAuthService } from '../../src/modules/auth/auth.service.js';
import type {
  AuthRepository,
  PasswordService,
  TokenService,
} from '../../src/modules/auth/auth.types.js';

const tokenService: TokenService = {
  expiresIn: 900,
  async sign(identity) {
    return `token-for-${identity.userId}`;
  },
  async verify() {
    return { userId: '1' };
  },
};

test('auth service returns credentials for a valid login', async () => {
  const repository: AuthRepository = {
    async findForLoginByEmail() {
      return {
        userId: '9007199254740993',
        email: 'user@example.com',
        passwordHash: 'stored-hash',
      };
    },
    async findCurrentUserById() {
      return null;
    },
  };
  const passwordService: PasswordService = {
    async compare(password, hash) {
      assert.equal(password, 'correct-password');
      assert.equal(hash, 'stored-hash');
      return true;
    },
    async hash(password) {
      return password;
    },
  };
  const service = createAuthService(repository, passwordService, tokenService);

  const result = await service.login({
    email: 'user@example.com',
    password: 'correct-password',
  });

  assert.deepEqual(result, {
    accessToken: 'token-for-9007199254740993',
    tokenType: 'Bearer',
    expiresIn: 900,
  });
});

test('unknown email and wrong password produce the same domain error', async (suite) => {
  const passwordInputs: string[] = [];
  const passwordService: PasswordService = {
    async compare(_password, hash) {
      passwordInputs.push(hash);
      return false;
    },
    async hash(password) {
      return password;
    },
  };

  const missingUserRepository: AuthRepository = {
    async findForLoginByEmail() {
      return null;
    },
    async findCurrentUserById() {
      return null;
    },
  };
  const existingUserRepository: AuthRepository = {
    async findForLoginByEmail() {
      return {
        userId: '1',
        email: 'user@example.com',
        passwordHash: 'stored-hash',
      };
    },
    async findCurrentUserById() {
      return null;
    },
  };

  await suite.test('unknown email', async () => {
    const service = createAuthService(
      missingUserRepository,
      passwordService,
      tokenService,
    );
    await assert.rejects(
      service.login({ email: 'missing@example.com', password: 'wrong' }),
      InvalidCredentialsError,
    );
  });

  await suite.test('wrong password', async () => {
    const service = createAuthService(
      existingUserRepository,
      passwordService,
      tokenService,
    );
    await assert.rejects(
      service.login({ email: 'user@example.com', password: 'wrong' }),
      InvalidCredentialsError,
    );
  });

  assert.equal(passwordInputs.length, 2);
  assert.notEqual(passwordInputs[0], '');
  assert.equal(passwordInputs[1], 'stored-hash');
});

test('auth service returns current user and rejects a missing user', async () => {
  const currentUser = {
    userId: '1',
    nama: 'Current User',
    email: 'current@example.com',
    employee: null,
  };
  const repository: AuthRepository = {
    async findForLoginByEmail() {
      return null;
    },
    async findCurrentUserById(userId) {
      return userId === '1' ? currentUser : null;
    },
  };
  const passwordService: PasswordService = {
    async compare() {
      return false;
    },
    async hash(password) {
      return password;
    },
  };
  const service = createAuthService(repository, passwordService, tokenService);

  assert.deepEqual(await service.getCurrentUser('1'), currentUser);
  await assert.rejects(service.getCurrentUser('2'), UnauthorizedError);
});
