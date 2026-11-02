// RootStore：加载 / 保存队列 / 订阅 / 日度备份
import { Plugin, Notice } from 'obsidian';
import {
  CommandCenterData, CC_SCHEMA_VERSION,
  defaultCmd, defaultSettings, defaultData, auditAll,
} from './models/root';
import { migratePlanning, normalizePlanning, syncPlanningSources } from './planning/model';
import { storagePaths } from './models/paths';

const INSPIRATION_STATUSES = new Set(['收件箱', '待使用', '已使用', '归档']);
const MAX_WRITE_BACKUPS = 30;

function makeId(prefix: string): string {
  return typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export class RootStore {
  data!: CommandCenterData;
  migrationReport = '';
  private listeners = new Set<() => void>();
  private saveTimer: number | null = null;
  private dirty = false;
  private writeChain: Promise<void> = Promise.resolve();
  private waiters: Array<{ resolve: () => void; reject: (reason: unknown) => void }> = [];

  readonly paths: ReturnType<typeof storagePaths>;

  constructor(private plugin: Plugin) {
    this.paths = storagePaths(plugin.app.vault.configDir, plugin.manifest.id);
  }

  private adapter() { return this.plugin.app.vault.adapter; }

  private async ensureFolder(path: string): Promise<void> {
    const adapter = this.adapter();
    const parts = path.split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
      current = current ? current + '/' + part : part;
      if (!(await adapter.exists(current))) await adapter.mkdir(current);
    }
  }

  private parseAndValidate(raw: string, source: string): CommandCenterData {
    const data = JSON.parse(raw) as CommandCenterData;
    const audit = auditAll(data);
    if (!audit.ok || !data.cmd || typeof data.cmd !== 'object' || !data.settings || typeof data.settings !== 'object') {
      const detail = audit.items.filter((item) => !item.ok).map((item) => item.detail).join('；');
      throw new Error(source + ' 结构异常' + (detail ? '：' + detail : ''));
    }
    return data;
  }

  private async readIfExists(path: string): Promise<string | null> {
    const adapter = this.adapter();
    return await adapter.exists(path) ? adapter.read(path) : null;
  }

  private timestamp(): string {
    const d = new Date();
    const date = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    const time = String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + String(d.getSeconds()).padStart(2, '0');
    return date + '-' + time + '-' + String(d.getMilliseconds()).padStart(3, '0');
  }

  private async latestValidBackup(): Promise<{ raw: string; path: string } | null> {
    const adapter = this.adapter();
    const files: string[] = [];
    for (const dir of [this.paths.writeBackupDir, this.paths.dailyBackupDir]) {
      if (!(await adapter.exists(dir))) continue;
      const listed = await adapter.list(dir);
      files.push(...listed.files.filter((path) => path.endsWith('.json')));
    }
    const ranked = await Promise.all(files.map(async (path) => ({
      path,
      mtime: (await adapter.stat(path))?.mtime ?? 0,
    })));
    ranked.sort((a, b) => b.mtime - a.mtime);
    for (const { path } of ranked) {
      try {
        const raw = await adapter.read(path);
        this.parseAndValidate(raw, path);
        return { raw, path };
      } catch (error) {
        console.error('[非凡人生] 跳过无效备份 ' + path, error);
      }
    }
    return null;
  }

  async load(): Promise<void> {
    let selected: { raw: string; source: string } | null = null;
    let storedDataExists = false;
    for (const candidate of [{ path: this.paths.dataPath, label: '插件数据' }]) {
      // A failed read must not be mistaken for a new installation.
      storedDataExists = await this.adapter().exists(candidate.path);
      try {
        const raw = await this.readIfExists(candidate.path);
        if (raw == null) continue;
        storedDataExists = true;
        this.parseAndValidate(raw, candidate.label);
        selected = { raw, source: candidate.path };
        break;
      } catch (error) {
        console.error('[非凡人生] ' + candidate.label + '读取或校验失败', error);
      }
    }

    if (!selected) {
      const backup = await this.latestValidBackup();
      if (backup) {
        selected = { raw: backup.raw, source: backup.path };
        new Notice('非凡人生：主数据不可用，已从最近有效备份恢复。', 10000);
      }
    }

    if (!selected && !storedDataExists) {
      this.data = defaultData();
      await this.writeSnapshot(JSON.stringify(this.data, null, 2));
    } else if (!selected) {
      new Notice('非凡人生：所有数据副本均不可用，已拒绝启动以避免覆盖。', 12000);
      throw new Error('No valid Feifan Life data source');
    } else {
      this.data = this.parseAndValidate(selected.raw, selected.source);
      if (selected.source !== this.paths.dataPath) {
        await this.writeSnapshot(JSON.stringify(this.data, null, 2));
      }
    }

    await this.dailyBackup();
  }

  /** 日度备份：每天首次加载时留存一份 data-YYYY-MM-DD.json */
  private async dailyBackup(): Promise<void> {
    const adapter = this.adapter();
    const d = new Date();
    const day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const target = this.paths.dailyBackupDir + '/data-' + day + '.json';
    try {
      if (!(await adapter.exists(target))) {
        await this.ensureFolder(this.paths.dailyBackupDir);
        const snapshot = JSON.stringify(this.data, null, 2);
        this.parseAndValidate(snapshot, '日度备份快照');
        await adapter.write(target, snapshot);
      }
    } catch (e) {
      console.error('[非凡人生] 日度备份失败', e);
    }
  }

  /* ---------- 变更路径：内存 → 保存队列 → 通知 ---------- */

  async mutate(fn: (d: CommandCenterData) => void): Promise<void> {
    fn(this.data);
    this.notify();
    await this.save();
  }

  save(): Promise<void> {
    this.dirty = true;
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    const done = new Promise<void>((resolve, reject) => this.waiters.push({ resolve, reject }));
    this.saveTimer = window.setTimeout(() => this.enqueueWrite(), 300);
    return done;
  }

  private enqueueWrite(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (!this.dirty) return;

    this.dirty = false;
    const snapshot = JSON.stringify(this.data, null, 2);
    const waiters = this.waiters.splice(0);
    const write = this.writeChain
      .catch(() => undefined)
      .then(() => this.writeSnapshot(snapshot));
    this.writeChain = write;
    void write.then(
      () => waiters.forEach(({ resolve }) => resolve()),
      (error) => {
        console.error('[非凡人生] 保存数据失败', error);
        new Notice('非凡人生：数据保存失败，请查看控制台。', 8000);
        waiters.forEach(({ reject }) => reject(error));
      },
    );
  }

  private async writeSnapshot(snapshot: string): Promise<void> {
    const adapter = this.adapter();
    this.parseAndValidate(snapshot, '待保存快照');
    await this.ensureFolder(this.paths.dataDir);
    await this.ensureFolder(this.paths.writeBackupDir);

    const current = await this.readIfExists(this.paths.dataPath);
    if (current != null && current !== snapshot) {
      let valid = true;
      try {
        this.parseAndValidate(current, '写入前主数据');
      } catch {
        valid = false;
      }
      if (valid) {
        await adapter.write(this.paths.writeBackupDir + '/data-before-' + this.timestamp() + '.json', current);
      } else {
        const faultDir = this.paths.backupDir + '/invalid';
        await this.ensureFolder(faultDir);
        await adapter.write(faultDir + '/invalid-primary-' + this.timestamp() + '.json', current);
      }
    }

    const tempPath = this.paths.dataDir + '/data.tmp.json';
    try {
      await adapter.write(tempPath, snapshot);
      const temporary = await adapter.read(tempPath);
      this.parseAndValidate(temporary, '临时写入校验');
      if (temporary !== snapshot) throw new Error('Temporary data verification failed');
      await adapter.write(this.paths.dataPath, snapshot);
      const saved = await adapter.read(this.paths.dataPath);
      this.parseAndValidate(saved, '主数据回读校验');
      if (saved !== snapshot) throw new Error('Saved data verification failed');
    } finally {
      if (await adapter.exists(tempPath)) await adapter.remove(tempPath).catch(() => {});
    }

    await this.pruneWriteBackups();
  }

  private async pruneWriteBackups(): Promise<void> {
    const adapter = this.adapter();
    try {
      const listed = await adapter.list(this.paths.writeBackupDir);
      const files = listed.files.filter((path) => path.endsWith('.json')).sort().reverse();
      for (const path of files.slice(MAX_WRITE_BACKUPS)) await adapter.remove(path);
    } catch (error) {
      console.error('[非凡人生] 清理滚动备份失败', error);
    }
  }

  async flush(): Promise<void> {
    while (this.saveTimer !== null || this.dirty) {
      this.enqueueWrite();
      await this.writeChain;
    }
    await this.writeChain;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private notify(): void {
    this.listeners.forEach(fn => fn());
  }

  /** 升级入口：schema 变更时在此做兼容迁移 */
  normalize(): boolean {
    let changed = this.data.schemaVersion !== CC_SCHEMA_VERSION;
    this.data.schemaVersion = CC_SCHEMA_VERSION;
    if (!this.data.cmd) { this.data.cmd = defaultCmd(); changed = true; }
    const cmd = this.data.cmd;
    if (!cmd.tokenDaily) { cmd.tokenDaily = {}; changed = true; }
    if (!Array.isArray(cmd.tokenManual)) { cmd.tokenManual = []; changed = true; }
    if (!cmd.quotes) { cmd.quotes = []; changed = true; }
    if (!cmd.goals) { cmd.goals = []; changed = true; }
    if (!Array.isArray(cmd.focusPins)) { cmd.focusPins = []; changed = true; }
    else {
      const seen = new Set<string>();
      const focusPins = cmd.focusPins.filter((pin) => {
        if (!pin || typeof pin.date !== 'string' || typeof pin.taskId !== 'string') return false;
        if (pin.subtaskId != null && typeof pin.subtaskId !== 'string') return false;
        const key = pin.date + '\u0000' + pin.taskId + '\u0000' + (pin.subtaskId ?? '');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (focusPins.length !== cmd.focusPins.length) { cmd.focusPins = focusPins; changed = true; }
    }
    if (!Array.isArray(cmd.inspirations)) { cmd.inspirations = []; changed = true; }
    if (!Array.isArray(cmd.habits)) { cmd.habits = []; changed = true; }
    if (!cmd.habitDaily || typeof cmd.habitDaily !== 'object') { cmd.habitDaily = {}; changed = true; }

    const planningMigration = migratePlanning(this.data);
    if (planningMigration.changed) {
      changed = true;
      this.migrationReport = `规划 v2：${planningMigration.sourceGoals} 个年度方向 + ${planningMigration.sourceVisions} 个愿景 → ${planningMigration.goals} 个年度目标 + ${planningMigration.visions} 个愿景与奖励；丢弃 ${planningMigration.discardedBlankConditions} 个空白条件`;
    }
    if (normalizePlanning(this.data)) changed = true;
    if (syncPlanningSources(this.data)) changed = true;

    const year = new Date().getFullYear();
    for (const goal of cmd.goals as any[]) {
      if (!goal.id) { goal.id = makeId('goal'); changed = true; }
      if (!Number.isFinite(goal.year)) { goal.year = year; changed = true; }
      if (!Array.isArray(goal.subs)) { goal.subs = []; changed = true; }
      for (const sub of goal.subs) {
        if (!sub.id) { sub.id = makeId('milestone'); changed = true; }
        if (typeof sub.done !== 'boolean') { sub.done = false; changed = true; }
      }
    }

    for (const inspiration of cmd.inspirations as any[]) {
      if (!inspiration.id) { inspiration.id = makeId('inspiration'); changed = true; }
      if (!Array.isArray(inspiration.tags)) { inspiration.tags = []; changed = true; }
      if (!INSPIRATION_STATUSES.has(inspiration.status)) { inspiration.status = '收件箱'; changed = true; }
      if (!inspiration.captureMode) { inspiration.captureMode = 'manual'; changed = true; }
      if (!Number.isFinite(inspiration.createdAt)) { inspiration.createdAt = Date.now(); changed = true; }
      if (!Number.isFinite(inspiration.updatedAt)) { inspiration.updatedAt = inspiration.createdAt; changed = true; }
      if (typeof inspiration.usedAt === 'undefined') { inspiration.usedAt = null; changed = true; }
      if (typeof inspiration.content !== 'string') { inspiration.content = ''; changed = true; }
      if (typeof inspiration.source !== 'string') { inspiration.source = ''; changed = true; }
      if (typeof inspiration.relatedTo !== 'string') { inspiration.relatedTo = ''; changed = true; }
    }

    const ids = new Set<string>();
    for (const habit of cmd.habits) {
      if (!habit.id || ids.has(habit.id)) {
        habit.id = typeof crypto?.randomUUID === 'function'
          ? crypto.randomUUID()
          : 'habit-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
        changed = true;
      }
      ids.add(habit.id);
      if (!habit.sched || typeof habit.sched !== 'object') { habit.sched = { t: '每天' }; changed = true; }
      if (!Number.isFinite(habit.times) || habit.times < 1) { habit.times = 1; changed = true; }
    }

    if (cmd.habitDoneToday && Object.keys(cmd.habitDoneToday).length) {
      const now = new Date();
      const day = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      const daily = cmd.habitDaily[day] ??= {};
      const claimedNames = new Set<string>();
      for (const habit of cmd.habits) {
        if (claimedNames.has(habit.name) || daily[habit.id] != null) continue;
        const legacyCount = Number(cmd.habitDoneToday[habit.name]);
        if (Number.isFinite(legacyCount) && legacyCount > 0) daily[habit.id] = legacyCount;
        claimedNames.add(habit.name);
      }
      delete cmd.habitDoneToday;
      changed = true;
    }

    const mergedSettings = { ...defaultSettings(), ...(this.data.settings ?? {}) };
    if (JSON.stringify(mergedSettings) !== JSON.stringify(this.data.settings)) changed = true;
    this.data.settings = mergedSettings;
    for (const key of ['nickname', 'greeting', 'heroImagePath', 'city', 'reviewPath'] as const) {
      if (typeof this.data.settings[key] !== 'string') { this.data.settings[key] = ''; changed = true; }
    }
    if (typeof this.data.settings.weatherEnabled !== 'boolean') { this.data.settings.weatherEnabled = false; changed = true; }
    if (!['lake', 'snow', 'mist', 'solid', 'custom'].includes(this.data.settings.heroBg)) { this.data.settings.heroBg = 'lake'; changed = true; }
    if (!Number.isFinite(this.data.settings.heroDim) || this.data.settings.heroDim < 0.2 || this.data.settings.heroDim > 0.9) {
      this.data.settings.heroDim = 0.7; changed = true;
    }
    if (this.data.settings.skin !== 'palette-1') { this.data.settings.skin = 'palette-1'; changed = true; }
    if (!['system', 'light', 'dark'].includes(this.data.settings.themeMode ?? '')) {
      this.data.settings.themeMode = 'system'; changed = true;
    }
    if (this.data.settings.defaultTab !== 'overview') { this.data.settings.defaultTab = 'overview'; changed = true; }
    return changed;
  }
}
