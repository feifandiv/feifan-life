import { RootStore } from '../src/store';
import { KanbanStore } from '../src/kanban/store';
import { FinanceStore } from '../src/finance/store';
import { LifeListStore } from '../src/life/store';

export class MemoryAdapter {
  files = new Map<string, string>();
  folders = new Set<string>();
  reads: string[] = [];
  writes: string[] = [];
  failWrite = '';
  async exists(path: string) { return this.files.has(path) || this.folders.has(path) || [...this.files.keys()].some(file=>file.startsWith(path+'/')); }
  async read(path: string) { this.reads.push(path); if(!this.files.has(path))throw new Error('Missing file'); return this.files.get(path)!; }
  async write(path: string, raw: string) { if(this.failWrite && path.includes(this.failWrite))throw new Error('Simulated write failure'); this.writes.push(path);this.files.set(path,raw); }
  async mkdir(path: string) { this.folders.add(path); }
  async remove(path: string) { this.files.delete(path); }
  async list(dir: string) { return {files:[...this.files.keys()].filter(file=>file.startsWith(dir+'/')&&!file.slice(dir.length+1).includes('/')),folders:[]}; }
  async stat(path: string) { return this.files.has(path)?{mtime:1}:null; }
}

export function fixture(configDir = '.custom-config', adapter = new MemoryAdapter()) {
  const plugin: any = {
    app: { vault: { configDir, adapter, getMarkdownFiles:()=>[],getAbstractFileByPath:()=>null } },
    manifest:{id:'feifan-life'}, theme:{attach:()=>()=>{},setMode:()=>{}},
    openPreferences:()=>{}, activeView:{refreshPreferences:()=>{}},
  };
  const root=new RootStore(plugin);
  plugin.stores={root,kanban:new KanbanStore({root}),finance:new FinanceStore({root}),life:new LifeListStore({root})};
  return {plugin,root,adapter};
}

export async function boot(instance: ReturnType<typeof fixture>) {
  const {root,plugin}=instance;
  await root.load(); root.normalize();
  await plugin.stores.life.load();await plugin.stores.finance.load();await plugin.stores.kanban.load();
  await root.save();
  return instance;
}
