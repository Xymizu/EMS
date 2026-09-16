export class ForbiddenError extends Error {
  constructor() {
    super('Insufficient permissions');
    this.name = 'ForbiddenError';
  }
}

export class EmployeeNotFoundError extends Error {
  constructor() {
    super('Employee not found');
    this.name = 'EmployeeNotFoundError';
  }
}

export class EmailAlreadyExistsError extends Error {
  constructor() {
    super('Email already exists');
    this.name = 'EmailAlreadyExistsError';
  }
}
