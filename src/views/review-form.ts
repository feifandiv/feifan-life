import { Notice, TFile, setIcon } from 'obsidian';
import type CommandCenterPlugin from '../main';
import { FfFormModal } from '../design-system/modal';
import { formField } from '../design-system/fields';
import { createReviewNote, DEFAULT_REVIEW_PATH, localReviewDate, REVIEW_FIELDS, reviewNotePath, type ReviewValues } from '../models/reviews';
import { vaultRelativePath } from '../models/paths';

export class ReviewModal extends FfFormModal {
  constructor(private plugin: CommandCenterPlugin, private saved?: () => void) {
    super(plugin.app, '新建复盘', 'ff-review');
  }

  onOpen(): void {
    super.onOpen();
    const metadata = this.bodyEl.createDiv({ cls: 'ff-review-meta' });
    const date = formField('日期', 'ff-review');
    const dateInput = date.input as HTMLInputElement;
    dateInput.type = 'date';
    dateInput.value = localReviewDate();
    metadata.append(date.row);
    const folder = formField('保存目录', 'ff-review');
    folder.input.value = this.plugin.stores.root.data.settings.reviewPath || DEFAULT_REVIEW_PATH;
    metadata.append(folder.row);
    const fields = new Map<string, HTMLTextAreaElement>();
    const entries = this.bodyEl.createDiv({ cls: 'ff-review-entries' });
    for (const title of REVIEW_FIELDS) {
      const field = formField(title, 'ff-review', true);
      const input = field.input as HTMLTextAreaElement;
      input.rows = 4;
      fields.set(title, input);
      entries.append(field.row);
    }
    const status = this.bodyEl.createDiv({ cls: 'ff-review-status', attr: { role: 'status', 'aria-live': 'polite' } });
    const cancel = this.footerEl.createEl('button', { cls: 'btn', text: '取消' });
    cancel.addEventListener('click', () => this.close());
    const submit = this.footerEl.createEl('button', { cls: 'btn primary', text: '保存复盘' });
    let existing: TFile | null = null;
    let pending = false;
    const checkExisting = (): void => {
      existing = null;
      try {
        const file = this.app.vault.getAbstractFileByPath(reviewNotePath(folder.input.value, dateInput.value));
        if (file instanceof TFile) existing = file;
        status.setText(existing ? '该日期已有复盘，现有内容将保留。' : '');
      } catch (error) { status.setText(error instanceof Error ? error.message : '日期或目录无效'); }
      submit.setText(existing ? '打开已有复盘' : '保存复盘');
      setIcon(submit.createSpan(), existing ? 'file-text' : 'check');
    };
    dateInput.addEventListener('change', checkExisting);
    folder.input.addEventListener('input', checkExisting);
    checkExisting();
    submit.addEventListener('click', () => {
      if (pending) return;
      pending = true;
      submit.disabled = true;
      void (async () => {
        try {
          const directory = vaultRelativePath(folder.input.value);
          const reviewDate = dateInput.value;
          const selectedPath = reviewNotePath(directory, reviewDate);
          if (existing?.path === selectedPath) {
            await this.app.workspace.getLeaf('tab').openFile(existing);
            this.close();
            return;
          }
          const values = Object.fromEntries(REVIEW_FIELDS.map(title => [title, fields.get(title)!.value])) as ReviewValues;
          const result = await createReviewNote(this.app.vault, directory, reviewDate, values);
          if (!result.created) { checkExisting(); return; }
          let preferencesSaved = true;
          try {
            await this.plugin.stores.root.mutate(data => { data.settings.reviewPath = directory; });
          } catch (error) {
            preferencesSaved = false;
            console.error('[Feifan Life] Review created but preferences could not be saved', error);
          }
          this.saved?.();
          this.close();
          new Notice(preferencesSaved ? '复盘已保存' : '复盘已保存，目录设置保存失败，请在设置中重新选择目录');
          await this.app.workspace.getLeaf('tab').openFile(result.file);
        } catch (error) {
          const message = error instanceof Error ? error.message : '复盘保存失败';
          status.setText(message);
          new Notice(message);
        } finally { pending = false; submit.disabled = false; }
      })();
    });
  }
}
