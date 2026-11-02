import test from 'node:test';
import assert from 'node:assert/strict';
import { installDOM } from './dom';
import { fixture, boot } from './fixture';
import { greetingText, avatarText } from '../src/models/profile';
import { renderHero, fetchWeather, renderReviewPanel } from '../src/views/dashboard';
import { FeifanSettingsTab } from '../src/settings';
import { TFile } from './mocks/obsidian';
import { CommandCenterView } from '../src/views/base';
import { BUILTIN_BACKGROUNDS } from '../src/models/backgrounds';

test('greeting has no fixed author name and handles custom names and text',()=>{
  const noon=new Date(2026,0,1,12,0);
  assert.equal(greetingText('','',noon),'中午好');
  assert.equal(greetingText('小林','',noon),'中午好，小林');
  assert.equal(greetingText('小林','欢迎回来',noon),'欢迎回来，小林');
  assert.equal(avatarText(''),'');assert.equal(avatarText('小林'),'小');
});

test('the actual hero renders a personalized greeting as text',async()=>{
  const dom=installDOM();const instance=await boot(fixture());
  instance.root.data.settings.nickname='<img src=x onerror=alert(1)>';
  instance.root.data.settings.greeting='欢迎回来';
  const host=document.createElement('div');renderHero(host,instance.plugin);
  assert.equal(host.querySelector('.hero-greet')?.textContent,'欢迎回来，<img src=x onerror=alert(1)>');
  assert.equal(host.querySelector('img'),null);
  instance.root.data.settings.nickname='';renderHero(host,instance.plugin);
  assert.equal(host.querySelector('.hero-avatar')?.getAttribute('data-icon'),'user-round');
  dom.window.close();
});

test('new installations have an embedded background and all presets render without network URLs', async () => {
  const dom = installDOM(); const instance = await boot(fixture());
  assert.equal(instance.root.data.settings.heroBg, 'lake');
  const host = document.createElement('div');
  for (const name of Object.keys(BUILTIN_BACKGROUNDS)) {
    instance.root.data.settings.heroBg = name;
    renderHero(host, instance.plugin);
    assert(host.style.backgroundImage.includes('data:image/jpeg;base64,'));
    assert(!host.style.backgroundImage.includes('https:'));
  }
  instance.root.data.settings.heroBg = 'solid'; renderHero(host, instance.plugin);
  assert.equal(host.style.backgroundImage, '');
  dom.window.close();
});

test('weather makes no requests before opt-in',async()=>{
  const instance=fixture();await instance.root.load();
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=(async()=>{calls++;throw new Error('Unexpected request');}) as typeof fetch;
  try{assert.equal(await fetchWeather(instance.plugin),false);assert.equal(calls,0);}finally{globalThis.fetch=original;}
});

test('disabling weather during a request prevents saving its location',async()=>{
  const dom=installDOM();const instance=fixture();await instance.root.load();
  instance.root.data.settings.weatherEnabled=true;instance.root.data.settings.city='Test City';
  const original=globalThis.fetch;
  globalThis.fetch=(async(url:string)=>({ok:true,json:async()=>url.includes('geocoding')
    ?{results:[{name:'Test City',latitude:1,longitude:1}]}
    :{current:{},daily:{}}})) as typeof fetch;
  try {
    const pending=fetchWeather(instance.plugin);
    instance.root.data.settings.weatherEnabled=false;
    assert.equal(await pending,false);
    assert.equal(instance.root.data.settings.weatherLocation,undefined);
  } finally {globalThis.fetch=original;dom.window.close();}
});

test('review reads nothing until a directory is explicitly configured, then only matching notes',async()=>{
  const dom=installDOM();const instance=await boot(fixture());let enumerated=0;const reads:string[]=[];
  const allowed=new TFile('Reviews/2026-01-01.md');const unrelated=new TFile('Private/2026-01-02.md');
  instance.plugin.app.vault.getMarkdownFiles=()=>{enumerated++;return[allowed,unrelated];};
  instance.plugin.app.vault.cachedRead=async(file:TFile)=>{reads.push(file.path);return '## 今日完成\nSynthetic content';};
  const host=document.createElement('div');renderReviewPanel(host,instance.plugin);
  await new Promise(resolve=>setTimeout(resolve,10));assert.equal(enumerated,0);assert.deepEqual(reads,[]);
  instance.root.data.settings.reviewPath='Reviews';renderReviewPanel(host,instance.plugin);
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.deepEqual(reads,['Reviews/2026-01-01.md']);assert(host.textContent?.includes('Synthetic content'));
  dom.window.close();
});

test('settings save persists nickname and folder preferences and refreshes the view',async()=>{
  const dom=installDOM();const instance=await boot(fixture());let refreshed=0;
  instance.plugin.activeView.refreshPreferences=()=>{refreshed++;};
  const tab=new FeifanSettingsTab(instance.plugin.app,instance.plugin);tab.display();
  const name=tab.containerEl.querySelector<HTMLInputElement>('input[aria-label="称呼"]')!;
  name.value='小林';name.dispatchEvent(new dom.window.Event('input'));
  const greeting=tab.containerEl.querySelector<HTMLInputElement>('input[aria-label="问候语"]')!;
  greeting.value='欢迎回来';greeting.dispatchEvent(new dom.window.Event('input'));
  tab.containerEl.querySelector<HTMLButtonElement>('button')!.click();
  await new Promise(resolve=>setTimeout(resolve,360));
  assert.equal(tab.containerEl.querySelector('[role="status"]')?.textContent,'已保存');
  const persisted=JSON.parse(instance.adapter.files.get(instance.root.paths.dataPath)!);
  assert.equal(persisted.settings.nickname,'小林');assert.equal(persisted.settings.greeting,'欢迎回来');
  assert.equal(refreshed,1);tab.hide();dom.window.close();
});

test('all eight modules mount from an empty installation without another vault',async()=>{
  const dom=installDOM();const instance=await boot(fixture());
  const view=new CommandCenterView({app:instance.plugin.app} as any,instance.plugin);
  document.body.append(view.containerEl);
  try {
    await view.onOpen();
    for(const tab of ['overview','tasks','planning','finance','life','habits','inspiration','review'] as const) {
      view.setTab(tab);
      assert(view.containerEl.querySelector(`[data-panel="${tab}"]`));
    }
    assert.equal(view.containerEl.querySelectorAll('[role="tab"]').length,8);
    assert.equal(instance.plugin.stores.kanban.getTasks().length,0);
    assert.equal(instance.root.data.life.inputs.length,0);
  } finally { await view.onClose();dom.window.close(); }
});
