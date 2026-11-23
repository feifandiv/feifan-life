import test from 'node:test';
import assert from 'node:assert/strict';
import { focusEntries, calendarTimeProgress } from '../src/models/focus';
import { todayStr, type Task, type Project } from '../src/kanban/models';
import { CommandCenterView } from '../src/views/base';
import { registerTheme, unregisterTheme, type ThemeController } from '../src/design-system/theme';
import { closeModals } from '../src/design-system/modal';
import { Notice } from './mocks/obsidian';
import { installDOM } from './dom';
import { boot, fixture } from './fixture';

const task = (id: string, patch: Partial<Task> = {}): Task => ({
  id, name: id, projectId: null, priority: 'P2', dueDate: null, done: false,
  note: '', tags: [], subtasks: [], archived: false, completedAt: null,
  progressUpdatedAt: null, progressBaselineDate: todayStr(), progressBaselinePct: 0,
  progressLog: [], createdAt: Date.now(), updatedAt: Date.now(), ...patch,
});

test('focus excludes unpinned due tasks, stale pins, missing and archived entries; sorts by completion then priority', () => {
  const date = '2026-11-23';
  const tasks = [task('low', { priority: 'P3', projectId: 'first' }), task('high', { priority: 'P0', projectId: 'second' }),
    task('due-only', { dueDate: date }), task('archived', { archived: true }), task('done', { priority: 'P0', done: true }),
    task('parent', { subtasks: [{ id: 'sub', name: 'quantified', target: 10, current: 10, done: false }] })];
  const pins = ['low', 'high', 'done', 'archived', 'missing'].map(taskId => ({ date, taskId }));
  pins.push({ date: '2026-11-22', taskId: 'due-only' }, { date, taskId: 'high' });
  const result = focusEntries([...pins, { date, taskId: 'parent', subtaskId: 'sub' }, { date, taskId: 'parent', subtaskId: 'missing' }], tasks,
    [{ id: 'first' }, { id: 'second' }] as Project[], date);
  assert.deepEqual(result.map(item => item.task.id), ['high', 'low', 'done', 'parent']);
  assert.equal(result.filter(item => item.done).length, 2);
  assert.deepEqual(focusEntries(pins, tasks, [], '2026-11-24'), []);
});

test('time progress starts at zero, handles leap months and never exceeds 100 at year end', () => {
  assert.deepEqual(calendarTimeProgress(new Date(2028, 0, 1)), { year: 0, month: 0 });
  assert.equal(calendarTimeProgress(new Date(2028, 1, 15, 12)).month, 50);
  assert.equal(calendarTimeProgress(new Date(2027, 1, 15)).month, 50);
  const end = calendarTimeProgress(new Date(2028, 11, 31, 23, 59, 59, 999));
  assert(end.year < 100 && end.year > 99.99);
  assert(end.month < 100 && end.month > 99.99);
  assert.deepEqual(calendarTimeProgress(new Date(2029, 0, 1)), { year: 0, month: 0 });
});

async function focusView() {
  const dom = installDOM();
  const instance = await boot(fixture());
  instance.root.data.kanban.tasks = [task('plain', { priority: 'P0' }), task('unfocused-overdue', { dueDate: '2020-01-01' }),
    task('parent', { subtasks: [
      { id: 'sub', name: 'focused subtask', target: 0, current: 0, done: false },
      { id: 'quantity', name: 'reached quantity', target: 10, current: 10, done: false },
    ] })];
  instance.root.data.cmd.focusPins = [{ date: todayStr(), taskId: 'plain' },
    { date: todayStr(), taskId: 'parent', subtaskId: 'sub' }, { date: todayStr(), taskId: 'parent', subtaskId: 'quantity' }];
  await instance.plugin.stores.kanban.load();
  registerTheme(instance.plugin.app, { attach: () => () => {} } as unknown as ThemeController);
  const view = new CommandCenterView({ app: instance.plugin.app } as any, instance.plugin);
  document.body.append(view.containerEl);
  await view.onOpen();
  const overview = () => view.containerEl.querySelector<HTMLElement>('[data-panel="overview"]')!;
  const rail = () => view.containerEl.querySelector<HTMLElement>('.cc-right')!;
  const close = async () => {
    closeModals(instance.plugin.app);
    unregisterTheme(instance.plugin.app);
    await view.onClose();
    dom.window.close();
  };
  return { ...instance, dom, view, overview, rail, close };
}

test('overview and rail synchronize completion, subtask completion, counts and removal, with persisted results', async () => {
  const ctx = await focusView();
  const names = (host: HTMLElement) => [...host.querySelectorAll('.cc-focus-copy .t')].map(el => el.textContent);
  const row = (host: HTMLElement, id: string) => [...host.querySelectorAll<HTMLElement>('.cc-focus-item')].find(el => el.dataset.subtaskId === id || el.dataset.taskId === id)!;
  try {
    assert.deepEqual(names(ctx.overview()), ['plain', 'focused subtask', 'reached quantity']);
    assert.deepEqual(names(ctx.overview()), names(ctx.rail()));
    row(ctx.overview(), 'plain').querySelector<HTMLInputElement>('.cc-focus-check')!.click();
    assert.equal(ctx.plugin.stores.kanban.getTask('plain').done, true);
    assert.deepEqual(names(ctx.overview()), names(ctx.rail()));
    for (const host of [ctx.overview(), ctx.rail()]) assert(host.textContent?.includes('已完成 2/3'));
    assert.equal(ctx.view.containerEl.querySelector('.cal-summary .num')?.textContent, '2/3');
    assert(ctx.overview().querySelector('.ov-bars')?.textContent?.includes('2/3 · 67%'));
    row(ctx.rail(), 'plain').querySelector<HTMLInputElement>('.cc-focus-check')!.click();
    row(ctx.overview(), 'sub').querySelector<HTMLInputElement>('.cc-focus-check')!.click();
    assert.equal(ctx.plugin.stores.kanban.getTask('parent').subtasks[0].done, true);
    row(ctx.rail(), 'sub').querySelector<HTMLButtonElement>('.cc-focus-remove')!.click();
    assert.deepEqual(names(ctx.overview()), names(ctx.rail()));
    assert.equal(names(ctx.overview()).length, 2);
    assert.equal(ctx.plugin.stores.kanban.getTasks().length, 3);
    assert.equal(row(ctx.overview(), 'quantity').querySelector<HTMLInputElement>('.cc-focus-check')!.disabled, true);
    await ctx.root.save();
    const reopened = await boot(fixture('.custom-config', ctx.adapter));
    assert.equal(reopened.root.data.cmd.focusPins.length, 2);
    assert.equal(reopened.plugin.stores.kanban.getTask('parent').subtasks[0].done, true);
  } finally { await ctx.close(); }
});

test('focus opens and saves details in place, including the selected subtask, without switching modules', async () => {
  const ctx = await focusView();
  try {
    ctx.overview().querySelector<HTMLButtonElement>('.cc-focus-item[data-subtask-id="sub"] .cc-focus-copy')!.click();
    const modal = document.querySelector<HTMLElement>('[role="dialog"]')!;
    assert(modal);
    assert.equal(ctx.view.containerEl.querySelector('.cc-tab[aria-selected="true"]')?.getAttribute('data-tab'), 'overview');
    assert.equal(modal.querySelector('.is-focus-target')?.getAttribute('data-subtask-id'), 'sub');
    // The host may focus its first field after onOpen; the shared modal lifecycle
    // must restore the requested subtask after that host behavior.
    modal.querySelector<HTMLInputElement>('.pk-modal__grid input')!.focus();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    assert.equal(document.activeElement, modal.querySelector('.pk-sub[data-subtask-id="sub"] .pk-sub__name'));
    const name = modal.querySelector<HTMLInputElement>('.pk-sub[data-subtask-id="sub"] .pk-sub__name')!;
    name.value = 'edited subtask'; name.dispatchEvent(new ctx.dom.window.Event('input'));
    modal.querySelector<HTMLButtonElement>('.pk-modal__actions .pk-btn--primary')!.click();
    await ctx.root.save();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(document.querySelector('[role="dialog"]'), null);
    for (const host of [ctx.overview(), ctx.rail()]) assert(host.textContent?.includes('edited subtask'));
    ctx.rail().querySelector<HTMLButtonElement>('.cc-focus-copy')!.click();
    assert(document.querySelector('[role="dialog"]'));
    assert.equal(ctx.view.containerEl.querySelector('.cc-tab[aria-selected="true"]')?.getAttribute('data-tab'), 'overview');
  } finally { await ctx.close(); }
});

test('detail write failure keeps the form open with a retryable save button', async () => {
  const ctx = await focusView();
  try {
    ctx.overview().querySelector<HTMLButtonElement>('.cc-focus-copy')!.click();
    const modal = document.querySelector<HTMLElement>('[role="dialog"]')!;
    ctx.plugin.stores.kanban.updateTask = async () => { throw new Error('Disk full'); };
    const save = modal.querySelector<HTMLButtonElement>('.pk-modal__actions .pk-btn--primary')!;
    save.click();
    await Promise.resolve(); await Promise.resolve();
    assert(modal.isConnected);
    assert.equal(save.disabled, false);
    assert.equal(Notice.messages.at(-1), '任务保存失败，请重试');
  } finally { await ctx.close(); }
});
