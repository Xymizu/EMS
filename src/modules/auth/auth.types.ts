export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginUserRecord {
  userId: string;
  email: string;
  passwordHash: string;
}

export interface EmployeeResponse {
  employeeId: string;
  role: string;
  tanggalMasuk: string;
}

export interface CurrentUserResponse {
  userId: string;
  nama: string;
  email: string;
  employee: EmployeeResponse | null;
}

export interface AuthenticatedIdentity {
  userId: string;
}

export interface AuthenticationCredentials {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface AuthRepository {
  findForLoginByEmail(email: string): Promise<LoginUserRecord | null>;
  findCurrentUserById(userId: string): Promise<CurrentUserResponse | null>;
}

export interface PasswordService {
  compare(plainPassword: string, passwordHash: string): Promise<boolean>;
  hash(plainPassword: string): Promise<string>;
}

export interface TokenService {
  sign(identity: AuthenticatedIdentity): Promise<string>;
  verify(token: string): Promise<AuthenticatedIdentity>;
  readonly expiresIn: number;
}
