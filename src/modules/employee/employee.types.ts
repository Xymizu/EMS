export type EmployeeRole = 'STAFF' | 'ADMIN' | 'SUPER_ADMIN';

export interface EmployeeResponse {
  employeeId: string;
  userId: string;
  nama: string;
  email: string;
  tanggalMasuk: string;
  role: EmployeeRole;
}

export interface CreateEmployeeInput {
  nama: string;
  email: string;
  password: string;
  tanggalMasuk: string;
  role: EmployeeRole;
}

export interface CreateEmployeeRecord extends Omit<CreateEmployeeInput, 'password'> {
  passwordHash: string;
}

export interface UpdateEmployeeInput {
  nama?: string;
  email?: string;
  password?: string;
  tanggalMasuk?: string;
  role?: EmployeeRole;
}

export interface UpdateEmployeeRecord extends Omit<UpdateEmployeeInput, 'password'> {
  passwordHash?: string;
}

export interface EmployeeRepository {
  findActorRoleByUserId(userId: string): Promise<EmployeeRole | null>;
  create(input: CreateEmployeeRecord): Promise<EmployeeResponse>;
  findAll(): Promise<EmployeeResponse[]>;
  findById(employeeId: string): Promise<EmployeeResponse | null>;
  update(
    employeeId: string,
    input: UpdateEmployeeRecord,
  ): Promise<EmployeeResponse | null>;
}
