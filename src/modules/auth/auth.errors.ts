export class ValidationError extends Error {
  constructor() {
    super('Invalid request');
    this.name = 'ValidationError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Authentication required');
    this.name = 'UnauthorizedError';
  }
}
