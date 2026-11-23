import { Notice, setIcon } from 'obsidian';
import type CommandCenterPlugin from '../main';
import { focusEntries } from '../models/focus';
import { taskSubtasks } from '../kanban/models';
import { openTaskDetail } from '../kanban/views/task-board';

export function todayFocusEntries(plugin: CommandCenterPlugin) {
  return focusEntries(plugin.stores.root.data.cmd.focusPins ?? [], plugin.stores.kanban.getTasks(), plugin.stores.kanban.getProjects());
}

/** Identical task actions and counts in the overview and the rail. */
export function renderFocusCard(host: HTMLElement, plugin: CommandCenterPlugin): void {
  host.empty();
  const entries = todayFocusEntries(plugin);
  const done = entries.filter(entry => entry.done).length;
  host.createDiv({ cls: 'card-title' }, title => {
    title.createSpan({ text: '今日聚焦' });
    title.createSpan({ cls: 'side num', text: '已完成 ' + done + '/' + entries.length });
  });
  if (!entries.length) host.createDiv({ cls: 'empty', text: '在「任务」页点击任务或子项旁的靶心，加入今日聚焦' });
  for (const { pin, task, subtask, project, done } of entries) {
    const row = host.createDiv({ cls: 'rail-item cc-focus-item' + (done ? ' done' : '') });
    row.dataset.taskId = task.id;
    if (subtask) row.dataset.subtaskId = subtask.id;
    const name = subtask?.name || task.name;
    const check = row.createEl('input', { cls: 'cc-focus-check', attr: { type: 'checkbox', 'aria-label': (done ? '取消完成：' : '标记完成：') + name } });
    check.checked = done;
    // A reached quantity remains completed even when its manual flag is cleared.
    // Edit that quantity in details instead of silently discarding recorded progress.
    const autoComplete = subtask ? subtask.target > 0 && subtask.current >= subtask.target
      : taskSubtasks(task).length > 0 && taskSubtasks(task).every(s => s.target > 0 && s.current >= s.target);
    if (done && autoComplete) {
      check.disabled = true;
      check.title = '量化目标已达成，点击任务详情修改当前值';
    }
    check.addEventListener('change', () => {
      check.disabled = true;
      const value = check.checked;
      const save = subtask ? plugin.stores.kanban.updateSubtask(task.id, subtask.id, { done: value })
        : plugin.stores.kanban.setTaskDone(task.id, value);
      void save.catch(() => {
        check.checked = done;
        check.disabled = false;
        new Notice('保存完成状态失败，请重试');
      });
    });
    const copy = row.createEl('button', { cls: 'cc-focus-copy', attr: { type: 'button', title: '打开任务详情', 'aria-label': '打开任务详情：' + name } });
    copy.createSpan({ cls: 't', text: name });
    if (subtask) copy.createSpan({ cls: 'cc-focus-parent', text: '所属任务 · ' + task.name });
    if (project) copy.createSpan({ cls: 'cc-focus-parent', text: project.name });
    copy.addEventListener('click', () => openTaskDetail({ app: plugin.app, store: plugin.stores.kanban }, task.id, pin.subtaskId));
    row.createSpan({ cls: 'cc-focus-priority ' + task.priority.toLowerCase(), text: task.priority });
    const remove = row.createEl('button', { cls: 'cc-focus-remove', attr: { type: 'button', 'aria-label': '移出今日聚焦：' + name, title: '移出今日聚焦' } });
    setIcon(remove, 'target');
    remove.addEventListener('click', () => {
      remove.disabled = true;
      void plugin.stores.root.mutate(data => {
        data.cmd.focusPins = (data.cmd.focusPins ?? []).filter(item => !(item.date === pin.date && item.taskId === pin.taskId && item.subtaskId === pin.subtaskId));
      }).catch(() => { remove.disabled = false; new Notice('移出今日聚焦失败，请重试'); });
    });
  }
}
