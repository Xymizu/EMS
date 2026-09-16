export class TaskNotFoundError extends Error {
  constructor() {
    super('Task not found');
    this.name = 'TaskNotFoundError';
  }
}

export class AssigneeNotProjectMemberError extends Error {
  constructor() {
    super('Assignee must be a project member');
    this.name = 'AssigneeNotProjectMemberError';
  }
}

export class InvalidTaskStatusTransitionError extends Error {
  constructor() {
    super('Invalid task status transition');
    this.name = 'InvalidTaskStatusTransitionError';
  }
}
