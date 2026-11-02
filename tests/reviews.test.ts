import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewNote, reviewNotePath, REVIEW_FIELDS, type ReviewValues } from '../src/models/reviews';
import { TFile, TFolder } from './mocks/obsidian';
import { installDOM } from './dom';
import { boot, fixture } from './fixture';
import { ReviewModal } from '../src/views/review-form';

function noteVault() {
  const files = new Map<string, string>();
  const folders = new Set<string>();
  const vault: any = {
    getAbstractFileByPath: (path: string) => files.has(path) ? new TFile(path)
      : folders.has(path) ? Object.assign(new TFolder(), { path }) : null,
    createFolder: async (path: string) => { folders.add(path); },
    create: async (path: string, content: string) => {
      if (files.has(path)) throw new Error('Already exists');
      files.set(path, content); return new TFile(path);
    },
  };
  return { files, folders, vault };
}
const values = (): ReviewValues => ({ 今日完成: 'Synthetic task', 问题解决: '', 今日纪念: '', 今日思考: 'Synthetic thought' });

test('review validates dates and vault-relative paths', () => {
  assert.equal(reviewNotePath('Reviews', '2028-02-29'), 'Reviews/2028-02-29.md');
  for (const date of ['2026-02-29', '2026-13-01', '2026-1-01', '../note']) assert.throws(() => reviewNotePath('Reviews', date));
  for (const folder of ['/private', '../private', '.obsidian', 'Reviews//Other']) assert.throws(() => reviewNotePath(folder, '2026-11-02'));
});

test('review creates a normal Markdown note with all four sections and missing folders', async () => {
  const { vault, files, folders } = noteVault();
  const result = await createReviewNote(vault, 'Feifan Life/Reviews', '2026-11-02', values());
  assert.equal(result.created, true);
  assert.deepEqual([...folders], ['Feifan Life', 'Feifan Life/Reviews']);
  const content = files.get(result.file.path)!;
  assert.match(content, /^# 2026-11-02 复盘/);
  for (const title of REVIEW_FIELDS) assert(content.includes(`## ${title}\n`));
});

test('same-date review never overwrites an existing note', async () => {
  const { vault, files, folders } = noteVault();
  files.set('Reviews/2026-11-02.md', 'Keep original contents');
  const result = await createReviewNote(vault, 'Reviews', '2026-11-02', values());
  assert.equal(result.created, false);
  assert.equal(files.get(result.file.path), 'Keep original contents');
  assert.equal(folders.size, 0);
});

test('empty review and a directory blocked by a file create no note', async () => {
  const { vault, files, folders } = noteVault();
  await assert.rejects(createReviewNote(vault, 'Reviews', '2026-11-02', { 今日完成: '', 问题解决: '', 今日纪念: '', 今日思考: '  ' }), /至少填写/);
  assert.equal(folders.size, 0);
  files.set('Reviews', 'Keep this file');
  await assert.rejects(createReviewNote(vault, 'Reviews', '2026-11-02', values()), /同名文件/);
  assert.deepEqual([...files], [['Reviews', 'Keep this file']]);
});

test('concurrent same-date creation preserves the other window and write errors surface', async () => {
  const { vault, files } = noteVault();
  vault.create = async (path: string) => { files.set(path, 'Another window'); throw new Error('Already exists'); };
  const result = await createReviewNote(vault, 'Reviews', '2026-11-02', values());
  assert.equal(result.created, false); assert.equal(files.get(result.file.path), 'Another window');
  vault.create = async () => { throw new Error('Disk full'); };
  await assert.rejects(createReviewNote(vault, 'Reviews', '2026-11-03', values()), /Disk full/);
});

test('review form saves content, remembers its directory and opens the created note', async () => {
  const dom = installDOM();
  const instance = await boot(fixture());
  const notes = noteVault(); let opened = ''; let refreshed = false;
  Object.assign(instance.plugin.app.vault, notes.vault);
  instance.plugin.app.workspace = { getLeaf: () => ({ openFile: async (file: TFile) => { opened = file.path; } }) };
  const modal = new ReviewModal(instance.plugin, () => { refreshed = true; });
  modal.onOpen();
  const content = modal.contentEl.querySelector<HTMLTextAreaElement>('textarea')!;
  content.value = 'Synthetic entry';
  modal.contentEl.querySelector<HTMLButtonElement>('.primary')!.click();
  await new Promise(resolve => setTimeout(resolve, 360));
  assert.equal(notes.files.size, 1); assert(opened.startsWith('Feifan Life/Reviews/'));
  assert.equal(instance.root.data.settings.reviewPath, 'Feifan Life/Reviews');
  assert.equal(refreshed, true);
  const persisted = JSON.parse(instance.adapter.files.get(instance.root.paths.dataPath)!);
  assert.equal(persisted.settings.reviewPath, 'Feifan Life/Reviews');
  dom.window.close();
});
