import type { CmdFocusPin } from './root';
import { PRIORITIES, type Project, type Task, type Subtask, subtaskComplete, taskIsDone, taskSubtasks, todayStr } from '../kanban/models';

export interface FocusEntry {
  pin: CmdFocusPin;
  task: Task;
  subtask?: Subtask;
  project?: Project;
  done: boolean;
}

/** All focus surfaces use explicit pins for the same local date. Due dates do not add pins. */
export function focusEntries(pins: CmdFocusPin[], tasks: Task[], projects: Project[], date = todayStr()): FocusEntry[] {
  const taskMap = new Map(tasks.map(task => [task.id, task]));
  const projectMap = new Map(projects.map(project => [project.id, project]));
  const projectOrder = new Map(projects.map((project, index) => [project.id, index]));
  const seen = new Set<string>();
  const entries: FocusEntry[] = [];
  for (const pin of pins) {
    if (pin.date !== date) continue;
    const key = JSON.stringify([pin.taskId, pin.subtaskId ?? null]);
    if (seen.has(key)) continue;
    const task = taskMap.get(pin.taskId);
    if (!task || task.archived) continue;
    const subtask = pin.subtaskId ? taskSubtasks(task).find(item => item.id === pin.subtaskId) : undefined;
    if (pin.subtaskId && !subtask) continue;
    seen.add(key);
    entries.push({ pin, task, subtask, project: projectMap.get(task.projectId ?? ''), done: subtask ? subtaskComplete(subtask) : taskIsDone(task) });
  }
  return entries.sort((a, b) => Number(a.done) - Number(b.done)
    || PRIORITIES.indexOf(a.task.priority) - PRIORITIES.indexOf(b.task.priority)
    || (projectOrder.get(a.task.projectId ?? '') ?? Number.MAX_SAFE_INTEGER) - (projectOrder.get(b.task.projectId ?? '') ?? Number.MAX_SAFE_INTEGER));
}

/** Fraction of actual local calendar time elapsed, bounded to 0..100. */
export function calendarTimeProgress(now = new Date()): { year: number; month: number } {
  const y = now.getFullYear(), m = now.getMonth();
  const elapsed = (start: Date, end: Date): number => Math.max(0, Math.min(100, (now.getTime() - start.getTime()) / (end.getTime() - start.getTime()) * 100));
  return { year: elapsed(new Date(y, 0, 1), new Date(y + 1, 0, 1)), month: elapsed(new Date(y, m, 1), new Date(y, m + 1, 1)) };
}
