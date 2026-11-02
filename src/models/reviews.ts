import { TFile, TFolder, type Vault } from 'obsidian';
import { vaultRelativePath } from './paths';

export const DEFAULT_REVIEW_PATH = 'Feifan Life/Reviews';
export const REVIEW_FIELDS = ['今日完成', '问题解决', '今日纪念', '今日思考'] as const;
export type ReviewValues = Record<typeof REVIEW_FIELDS[number], string>;

export function localReviewDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function reviewNotePath(directory: string, date: string): string {
  const base = vaultRelativePath(directory);
  const parsed = new Date(`${date}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || localReviewDate(parsed) !== date) {
    throw new Error('请选择有效的复盘日期');
  }
  return `${base}/${date}.md`;
}

export function reviewMarkdown(date: string, values: ReviewValues): string {
  return `# ${date} 复盘\n\n` + REVIEW_FIELDS.map(title => `## ${title}\n\n${values[title].trim()}\n`).join('\n');
}

export async function createReviewNote(vault: Vault, directory: string, date: string, values: ReviewValues): Promise<{ file: TFile; created: boolean }> {
  const path = reviewNotePath(directory, date);
  const existing = vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) return { file: existing, created: false };
  if (existing) throw new Error('复盘文件路径已被文件夹占用');
  if (!REVIEW_FIELDS.some(title => values[title].trim())) throw new Error('请至少填写一项复盘内容');
  const parts = vaultRelativePath(directory).split('/');
  for (let index = 1; index <= parts.length; index++) {
    const folderPath = parts.slice(0, index).join('/');
    const folder = vault.getAbstractFileByPath(folderPath);
    if (folder instanceof TFolder) continue;
    if (folder) throw new Error('复盘目录中存在同名文件');
    try { await vault.createFolder(folderPath); }
    catch (error) {
      if (!(vault.getAbstractFileByPath(folderPath) instanceof TFolder)) throw error;
    }
  }
  try { return { file: await vault.create(path, reviewMarkdown(date, values)), created: true }; }
  catch (error) {
    // A second window may have created today's note while this form was open.
    const raced = vault.getAbstractFileByPath(path);
    if (raced instanceof TFile) return { file: raced, created: false };
    throw error;
  }
}
