import bcrypt from 'bcryptjs';

import type { PasswordService } from './auth.types.js';

export function createPasswordService(): PasswordService {
  return {
    compare(plainPassword: string, passwordHash: string): Promise<boolean> {
      return bcrypt.compare(plainPassword, passwordHash);
    },
  };
}
