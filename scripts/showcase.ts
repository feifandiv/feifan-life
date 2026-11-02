import { readFile, writeFile } from 'node:fs/promises';
import { createElement, icons } from 'lucide';
import { installDOM } from '../tests/dom';
import { fixture, boot } from '../tests/fixture';
import { TFile } from '../tests/mocks/obsidian';
import { CommandCenterView, type TabKey } from '../src/views/base';

async function main() {
// Synthetic examples live only in this development renderer, never in plugin defaults.
const date = '2026-11-02';
const month = date.slice(0, 7);
const now = new Date(date + 'T09:00:00+08:00').getTime();
const dom = installDOM();
const { plugin, root } = await boot(fixture());
root.data.settings.nickname = '小林';
root.data.settings.greeting = '欢迎回来';
root.data.settings.reviewPath = 'Demo/Reviews';
root.data.kanban.settings.defaultView = 'project';
root.data.kanban.projects = [
  ['project-1', '完成个人作品集', '事业', 'P0', '整理案例，完成作品集第一版。'],
  ['project-2', '建立阅读与运动节奏', '个人', 'P2', '每周保留阅读与户外时间。'],
  ['project-3', '准备季度分享', '工作', 'P1', '收集材料，整理分享提纲。'],
].map(([id, name, category, priority, description]) => ({ id, name, category, priority, description,
  startDate: '2026-11-01', dueDate: '2026-11-30', tags: [], createdAt: now, updatedAt: now }));
root.data.kanban.tasks = [
  ['task-1', 'project-1', '整理三个代表案例', 'P0', false],
  ['task-2', 'project-1', '完成作品集目录', 'P1', true],
  ['task-3', 'project-1', '制作案例展示页', 'P2', false],
  ['task-4', 'project-2', '阅读并写一页笔记', 'P2', false],
  ['task-5', 'project-2', '完成本周第一次步行', 'P3', true],
  ['task-6', 'project-3', '整理分享提纲', 'P1', false],
].map(([id, projectId, name, priority, done]) => ({ id, projectId, name, priority, done,
  dueDate: id === 'task-1' || id === 'task-6' ? date : '2026-11-06', note: '', tags: [], subtasks: [], archived: false,
  completedAt: done ? now : null, progressUpdatedAt: null, progressBaselineDate: date,
  progressBaselinePct: done ? 100 : 0, progressLog: [], createdAt: now, updatedAt: now }));
root.data.cmd.focusPins = [{ date, taskId: 'task-1' }, { date, taskId: 'task-6' }];
root.data.cmd.habits = [
  { id: 'habit-1', name: '喝水', sched: { t: '每天' }, times: 4, unit: '杯' },
  { id: 'habit-2', name: '阅读', sched: { t: '每天' }, times: 1, unit: '次' },
  { id: 'habit-3', name: '步行', sched: { t: '工作日' }, times: 1, unit: '次' },
  { id: 'habit-4', name: '记录灵感', sched: { t: '每天' }, times: 1, unit: '条' },
];
root.data.cmd.habitDaily = {
  '2026-11-01': { 'habit-1': 4, 'habit-2': 1, 'habit-4': 1 },
  [date]: { 'habit-1': 2, 'habit-2': 1, 'habit-3': 1 },
};
root.data.cmd.inspirations = [
  ['inspiration-1', '把阅读笔记变成可行动的清单', '每次阅读后只选一个可以实践的想法。', '观点', '待使用'],
  ['inspiration-2', '记录作品从草稿到完成的过程', '保留关键修改前后的对照，帮助下一次复盘。', '选题', '收件箱'],
  ['inspiration-3', '每周留一段不安排任务的时间', '观察哪些活动真正帮助恢复精力。', '故事', '收件箱'],
].map(([id, title, content, type, status]) => ({ id, title, content, type, status,
  tags: ['示例'], source: '合成演示', captureMode: 'manual', relatedTo: '',
  createdAt: now, updatedAt: now, usedAt: null })) as any;
root.data.cmd.planning = {
  version: 2, migratedAt: now, visions: [], goals: [{
    id: 'goal-1', name: '完成自己的作品集', year: 2026, priority: 'P0',
    note: '用可展示的成果记录这一年的积累。', mode: 'cumulative', period: 'annual',
    achievementRule: 'sum', autoAdjust: false, evidence: [], createdAt: now, updatedAt: now,
    metrics: [{ id: 'metric-1', name: '完成案例', target: 6, current: 2, unit: '个',
      source: { kind: 'manual', label: '手动记录' },
      originalPlan: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 2], actualByMonth: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0] }],
  }],
};
const ledger = root.data.finance.ledgers.personal;
ledger.monthlyBudget = 3000;
ledger.categories = [
  { id: 'cat-income', level: 2, parentId: null, name: '工作收入', type: '收入', sortOrder: 0 },
  { id: 'cat-wage', level: 3, parentId: 'cat-income', name: '工资', type: '收入', sortOrder: 0 },
  { id: 'cat-2', level: 2, parentId: null, name: '日常生活', type: '支出', sortOrder: 0 },
  { id: 'cat-3', level: 3, parentId: 'cat-2', name: '餐饮', type: '支出', sortOrder: 0 },
  { id: 'cat-transport', level: 3, parentId: 'cat-2', name: '交通', type: '支出', sortOrder: 1 },
  { id: 'cat-growth', level: 2, parentId: null, name: '个人成长', type: '支出', sortOrder: 1 },
  { id: 'cat-books', level: 3, parentId: 'cat-growth', name: '图书', type: '支出', sortOrder: 0 },
];
ledger.transactions = [
  ['txn-1', '收入', 8000, '工作收入', '工资', '示例收入'],
  ['txn-2', '支出', 38, '日常生活', '餐饮', '午餐'],
  ['txn-3', '支出', 16, '日常生活', '交通', '公共交通'],
  ['txn-4', '支出', 68, '个人成长', '图书', '阅读计划'],
].map(([id, type, amount, cat2, cat3, note]) => ({ id, type, amount, cat1: '个人', cat2, cat3, note, date, createdAt: new Date(now).toISOString() }));
root.data.life.inputs = [
  ['input-1', '读书', '一周阅读手记', '示例作者'],
  ['input-2', '观影', '一次周末旅行', '示例创作者'],
  ['input-3', '学习', '从零完成一份作品集', '示例课程'],
].map(([id, type, name, creator]) => ({ id, type, name, creator, rating: 'A', category: '',
  completedMonth: month, keywords: [], description: '', influence: '整理了一个可实践的想法',
  createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() }));
const review = new TFile('Demo/Reviews/' + date + '.md');
plugin.app.vault.getMarkdownFiles = () => [review];
plugin.app.vault.getAbstractFileByPath = (path: string) => path === review.path ? review : null;
plugin.app.vault.cachedRead = async () => '# ' + date + ' 复盘\n\n## 今日完成\n完成作品集目录，阅读并整理了一页笔记。\n\n## 问题解决\n把一个大任务拆成三个可以行动的小步骤。\n\n## 今日纪念\n留出一段时间散步。\n\n## 今日思考\n先完成可用的一版，再逐步改进。\n';
await plugin.stores.life.load();
await plugin.stores.finance.load();
await plugin.stores.kanban.load();
if (plugin.stores.kanban.getTasks().length !== 6) throw new Error('Synthetic tasks did not load');
const css = await readFile('build/styles.css', 'utf8');
const tabs: TabKey[] = ['overview', 'tasks', 'planning', 'finance', 'life', 'habits', 'inspiration', 'review'];
const view = new CommandCenterView({ app: plugin.app } as any, plugin);
document.body.append(view.containerEl);
await view.onOpen();
view.containerEl.classList.add('ff-ui');
view.containerEl.dataset.ffPalette = 'palette-1';
const base = '*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;font-size:13px;line-height:1.5}button,input,select,textarea{font:inherit}button{cursor:pointer}button,input{margin:0}button{border:0}svg.lucide{width:16px;height:16px;display:inline-block;vertical-align:middle}h1,h2,h3,p{margin:0}';
try {
  for (const tab of tabs) {
    view.setTab(tab);
    await new Promise(resolve => setTimeout(resolve, 30));
    for (const mode of (tab === 'overview' ? ['light', 'dark'] : ['light'])) {
      view.containerEl.dataset.ffMode = mode;
      const clone = view.containerEl.cloneNode(true) as HTMLElement;
      for (const el of clone.querySelectorAll<HTMLElement>('[data-icon]')) {
        const key = el.dataset.icon!.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('');
        const icon = icons[key as keyof typeof icons];
        if (!icon) throw new Error('Unknown Lucide icon: ' + key);
        el.append(createElement(icon, { width: '16', height: '16', class: 'lucide', 'stroke-width': '2' }));
      }
      for (const input of clone.querySelectorAll<HTMLInputElement>('input')) {
        if (input.value) input.setAttribute('value', input.value);
      }
      await writeFile('.showcase/' + tab + '-' + mode + '.html', '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>非凡人生 · 合成演示 · ' + tab + '</title><style>' + base + css + '</style><body class="theme-' + mode + '">' + clone.outerHTML + '</body></html>');
      console.log('Rendered ' + tab + ' / ' + mode);
    }
  }
} finally { await view.onClose(); dom.window.close(); }
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
