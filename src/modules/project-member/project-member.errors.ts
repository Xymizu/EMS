export class ProjectMemberNotFoundError extends Error {
  constructor() {
    super('Project member not found');
    this.name = 'ProjectMemberNotFoundError';
  }
}

export class ProjectMemberAlreadyExistsError extends Error {
  constructor() {
    super('Employee is already a project member');
    this.name = 'ProjectMemberAlreadyExistsError';
  }
}

export class ProjectLeadCannotBeRemovedError extends Error {
  constructor() {
    super('Project lead cannot be removed from project members');
    this.name = 'ProjectLeadCannotBeRemovedError';
  }
}

export class ProjectMemberHasTasksError extends Error {
  constructor() {
    super('Project member still has assigned tasks');
    this.name = 'ProjectMemberHasTasksError';
  }
}
