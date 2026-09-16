export class ProjectNotFoundError extends Error {
  constructor() {
    super('Project not found');
    this.name = 'ProjectNotFoundError';
  }
}

export class LeadEmployeeNotFoundError extends Error {
  constructor() {
    super('Lead employee not found');
    this.name = 'LeadEmployeeNotFoundError';
  }
}

export class ProjectHasDependenciesError extends Error {
  constructor() {
    super('Project cannot be deleted while it has members or tasks');
    this.name = 'ProjectHasDependenciesError';
  }
}
