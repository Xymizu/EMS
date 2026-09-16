import bcrypt from 'bcryptjs';

import type { PasswordService } from './auth.types.js';

export function createPasswordService(rounds = 12): PasswordService {
  return {
    compare(plainPassword: string, passwordHash: string): Promise<boolean> {
      return bcrypt.compare(plainPassword, passwordHash);
    },
    hash(plainPassword: string): Promise<string> {
      return bcrypt.hash(plainPassword, rounds);
    },
  };
}
