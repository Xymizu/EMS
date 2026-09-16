import type { EmployeeRole } from '../employee/employee.types.js';
import type { TaskStatus } from './task.types.js';

export interface TaskStatusAuthorizationContext {
  actorEmployeeId: string;
  actorRole: EmployeeRole;
  assignedEmployeeId: string;
  leadEmployeeId: string;
}

const TRANSITIONS: Readonly<Record<TaskStatus, ReadonlySet<TaskStatus>>> = {
  TODO: new Set(['IN_PROGRESS']),
  IN_PROGRESS: new Set(['TODO', 'DONE']),
  DONE: new Set(['IN_PROGRESS']),
};

export function canUpdateTaskStatus(
  context: TaskStatusAuthorizationContext,
): boolean {
  return (
    context.actorRole === 'ADMIN' ||
    context.actorRole === 'SUPER_ADMIN' ||
    context.actorEmployeeId === context.assignedEmployeeId ||
    context.actorEmployeeId === context.leadEmployeeId
  );
}

export function canTransitionTaskStatus(
  currentStatus: TaskStatus,
  targetStatus: TaskStatus,
): boolean {
  return TRANSITIONS[currentStatus].has(targetStatus);
}
