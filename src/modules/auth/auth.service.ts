import {
  InvalidCredentialsError,
  UnauthorizedError,
} from './auth.errors.js';
import type {
  AuthenticationCredentials,
  AuthRepository,
  CurrentUserResponse,
  LoginInput,
  PasswordService,
  TokenService,
} from './auth.types.js';

const DUMMY_BCRYPT_HASH =
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxpT4vwYVE/Yl8X9i8qkB8zT0aK';

export interface AuthService {
  login(input: LoginInput): Promise<AuthenticationCredentials>;
  getCurrentUser(userId: string): Promise<CurrentUserResponse>;
}

export function createAuthService(
  repository: AuthRepository,
  passwordService: PasswordService,
  tokenService: TokenService,
): AuthService {
  return {
    async login(input: LoginInput): Promise<AuthenticationCredentials> {
      const user = await repository.findForLoginByEmail(input.email);
      const passwordMatches = await passwordService.compare(
        input.password,
        user?.passwordHash ?? DUMMY_BCRYPT_HASH,
      );

      if (!user || !passwordMatches) {
        throw new InvalidCredentialsError();
      }

      return {
        accessToken: await tokenService.sign({ userId: user.userId }),
        tokenType: 'Bearer',
        expiresIn: tokenService.expiresIn,
      };
    },

    async getCurrentUser(userId: string): Promise<CurrentUserResponse> {
      const user = await repository.findCurrentUserById(userId);
      if (!user) {
        throw new UnauthorizedError();
      }
      return user;
    },
  };
}
