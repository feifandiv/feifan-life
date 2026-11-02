import { App, Notice, PluginSettingTab, Setting, TFile } from 'obsidian';
import type CommandCenterPlugin from './main';
import type { CCSettings } from './models/root';
import { vaultRelativePath } from './models/paths';
import { FfModal } from './design-system/modal';
import { BACKGROUND_OPTIONS } from './models/backgrounds';

function preferencesForm(host: HTMLElement, plugin: CommandCenterPlugin, saved?: () => void): void {
  const draft: CCSettings = { ...plugin.stores.root.data.settings };
  host.addClass('fl-preferences');
  new Setting(host).setName('称呼').addText(text => {
    text.inputEl.maxLength = 40;
    text.inputEl.setAttribute('aria-label', '称呼');
    text.setValue(draft.nickname).onChange(value => { draft.nickname = value; });
  });
  new Setting(host).setName('问候语').addText(text => {
    text.inputEl.maxLength = 120;
    text.inputEl.setAttribute('aria-label', '问候语');
    text.setPlaceholder('按时间自动问候').setValue(draft.greeting).onChange(value => { draft.greeting = value; });
  });
  new Setting(host).setName('显示模式').addDropdown(dropdown => dropdown
    .addOptions({ system: '跟随 Obsidian', light: '日间', dark: '夜间' })
    .setValue(draft.themeMode ?? 'system').onChange(value => { draft.themeMode = value as CCSettings['themeMode']; }));
  let imageSetting: Setting;
  new Setting(host).setName('背景方案').addDropdown(dropdown => dropdown
    .addOptions(BACKGROUND_OPTIONS).setValue(draft.heroBg)
    .onChange(value => { draft.heroBg = value; imageSetting.settingEl.hidden = value !== 'custom'; }));
  imageSetting = new Setting(host).setName('背景图片').addText(text => text
    .setPlaceholder('知识库内图片路径（可选）').setValue(draft.heroImagePath)
    .onChange(value => { draft.heroImagePath = value; }));
  imageSetting.settingEl.hidden = draft.heroBg !== 'custom';
  new Setting(host).setName('图片遮罩').addSlider(slider => slider
    .setLimits(0.2, 0.9, 0.05).setValue(draft.heroDim).setDynamicTooltip()
    .onChange(value => { draft.heroDim = value; }));
  new Setting(host).setName('天气').addToggle(toggle => toggle
    .setValue(draft.weatherEnabled).onChange(value => { draft.weatherEnabled = value; }));
  new Setting(host).setName('城市').addText(text => text
    .setValue(draft.city).onChange(value => { draft.city = value; }));
  new Setting(host).setName('复盘目录').addText(text => text
    .setPlaceholder('知识库内目录（可选）').setValue(draft.reviewPath)
    .onChange(value => { draft.reviewPath = value; }));
  new Setting(host).setName('任务镜像目录').addText(text => text
    .setValue(draft.mirrorPath).onChange(value => { draft.mirrorPath = value; }));
  const status = host.createDiv({ cls: 'fl-preferences-status', attr: { role: 'status', 'aria-live': 'polite' } });
  new Setting(host).addButton(button => button.setButtonText('保存设置').setCta().onClick(() => {
    if (button.buttonEl.disabled) return;
    void (async () => {
      try {
        const imagePath = draft.heroBg === 'custom' ? vaultRelativePath(draft.heroImagePath) : draft.heroImagePath;
        const reviewPath = vaultRelativePath(draft.reviewPath, true);
        const mirrorPath = vaultRelativePath(draft.mirrorPath);
        if (draft.heroBg === 'custom') {
          const file = plugin.app.vault.getAbstractFileByPath(imagePath);
          if (!(file instanceof TFile) || !/^(png|jpe?g|gif|webp|avif)$/i.test(file.extension)) {
            throw new Error('背景图片不存在，或格式不受支持');
          }
        }
        if (reviewPath) {
          const file = plugin.app.vault.getAbstractFileByPath(reviewPath);
          if (file instanceof TFile) throw new Error('复盘目录不能是文件');
        }
        if (draft.weatherEnabled && !draft.city.trim()) throw new Error('启用天气前请填写城市');
        button.setDisabled(true).setButtonText('正在保存…');
        status.setText('正在保存…');
        const cityChanged = draft.city.trim() !== plugin.stores.root.data.settings.city;
        const mirrorChanged = mirrorPath !== plugin.stores.kanban.getSettings().vaultPath;
        await plugin.stores.root.mutate(data => {
          data.settings = {
            ...draft, nickname: draft.nickname.trim(), greeting: draft.greeting.trim(),
            city: draft.city.trim(), heroImagePath: imagePath,
            reviewPath, mirrorPath,
          };
          if (cityChanged) delete data.settings.weatherLocation;
          data.kanban.settings.vaultPath = mirrorPath;
        });
        // Keep the module's in-memory settings aligned with the shared snapshot.
        if (mirrorChanged) await plugin.stores.kanban.setSettings({ vaultPath: mirrorPath });
        plugin.theme.setMode(draft.themeMode ?? 'system');
        plugin.activeView?.refreshPreferences();
        status.setText('已保存');
        saved?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : '设置保存失败';
        status.setText(message);
        new Notice(message);
      } finally {
        button.setDisabled(false).setButtonText('保存设置');
      }
    })();
  }));
}

export class PreferencesModal extends FfModal {
  constructor(private plugin: CommandCenterPlugin) { super(plugin.app); }
  onOpen(): void {
    this.setTitle('个性化设置');
    preferencesForm(this.contentEl, this.plugin, () => this.close());
  }
  onClose(): void { this.contentEl.empty(); }
}

export class FeifanSettingsTab extends PluginSettingTab {
  private detachTheme?: () => void;
  constructor(app: App, private owner: CommandCenterPlugin) { super(app, owner); }
  display(): void {
    this.detachTheme?.();
    this.containerEl.empty();
    this.detachTheme = this.owner.theme.attach(this.containerEl);
    this.containerEl.createEl('h2', { text: '非凡人生' });
    preferencesForm(this.containerEl, this.owner);
  }
  hide(): void { this.detachTheme?.(); this.detachTheme = undefined; }
}
