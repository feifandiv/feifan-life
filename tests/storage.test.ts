import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultData, auditAll } from '../src/models/root';
import { storagePaths, vaultRelativePath } from '../src/models/paths';
import { boot, fixture } from './fixture';

Object.defineProperty(globalThis,'window',{configurable:true,value:globalThis});

test('a fresh default contains no user records and is valid before the first save',()=>{
  const data=defaultData();
  assert.equal(auditAll(data).ok,true);
  assert.deepEqual(data.kanban.projects,[]); assert.deepEqual(data.kanban.tasks,[]);
  assert.deepEqual(data.life.inputs,[]);assert.deepEqual(data.life.inventory,[]);
  assert.deepEqual(data.cmd.habits,[]);assert.deepEqual(data.cmd.inspirations,[]);
  assert.deepEqual(data.cmd.tokenManual,[]);assert.deepEqual(data.cmd.quotes,[]);
  for(const bucket of Object.values(data.finance.ledgers) as any[]) {
    for(const key of ['transactions','categories','debts','receivables','assets','savings','fundingPlans'])assert.deepEqual(bucket[key],[]);
    assert.equal(bucket.monthlyBudget,0);assert.equal(bucket.balanceOverride,null);
  }
  assert.equal(data.settings.nickname,'');assert.equal(data.settings.city,'');
  assert.equal(data.settings.weatherEnabled,false);assert.equal(data.settings.reviewPath,'');
  const second=defaultData();data.cmd.habits.push({id:'test',name:'Test',sched:{t:'每天'},times:1});
  assert.deepEqual(second.cmd.habits,[]);
});

test('first boot and a saved task survive reload using only this plugin storage',async()=>{
  const instance=fixture();
  instance.adapter.files.set('.custom-config/plugins/another-plugin/data.json','private sentinel');
  await boot(instance);
  const project=await instance.plugin.stores.kanban.addProject({name:'Synthetic project'});
  await instance.plugin.stores.kanban.addTask({name:'Synthetic task',projectId:project.id});
  await instance.root.mutate(data=>{data.settings.nickname='测试用户';});
  await instance.root.flush();
  const reopened=await boot(fixture('.custom-config',instance.adapter));
  assert.equal(reopened.plugin.stores.kanban.getTasks()[0].name,'Synthetic task');
  assert.equal(reopened.root.data.settings.nickname,'测试用户');
  assert.equal(instance.adapter.files.get('.custom-config/plugins/another-plugin/data.json'),'private sentinel');
  assert(instance.adapter.reads.every(path=>path.startsWith(instance.root.paths.dataDir+'/')));
  assert(instance.adapter.writes.every(path=>path.startsWith(instance.root.paths.dataDir+'/')));
});

test('a corrupt primary is preserved and recovered from this plugin backup',async()=>{
  const instance=fixture(); const backup=defaultData();backup.settings.nickname='Recovered';
  instance.adapter.files.set(instance.root.paths.dataPath,'broken JSON');
  instance.adapter.files.set(instance.root.paths.dailyBackupDir+'/data-test.json',JSON.stringify(backup));
  await instance.root.load();
  assert.equal(instance.root.data.settings.nickname,'Recovered');
  assert([...instance.adapter.files].some(([path,raw])=>path.includes('/invalid/')&&raw==='broken JSON'));
});

test('corrupt data without a valid backup is never replaced with defaults',async()=>{
  const instance=fixture();instance.adapter.files.set(instance.root.paths.dataPath,'broken JSON');
  await assert.rejects(instance.root.load(),/No valid/);
  assert.equal(instance.adapter.files.get(instance.root.paths.dataPath),'broken JSON');
  assert.deepEqual(instance.adapter.writes,[]);
});

test('a failed write rejects the save promise and retains the previous primary',async()=>{
  const instance=await boot(fixture());const before=instance.adapter.files.get(instance.root.paths.dataPath);
  instance.adapter.failWrite='/data.tmp.json';
  await assert.rejects(instance.root.mutate(data=>{data.settings.nickname='Unsaved';}),/Simulated/);
  assert.equal(instance.adapter.files.get(instance.root.paths.dataPath),before);
});

test('backup failure prevents replacing a valid primary',async()=>{
  const instance=await boot(fixture());const before=instance.adapter.files.get(instance.root.paths.dataPath);
  instance.adapter.failWrite='/before-write/';
  await assert.rejects(instance.root.mutate(data=>{data.settings.nickname='Unsaved';}),/Simulated/);
  assert.equal(instance.adapter.files.get(instance.root.paths.dataPath),before);
});

test('storage paths honor the current config directory and separate plugin IDs',()=>{
  assert.equal(storagePaths('.settings','feifan-life').dataPath,'.settings/plugins/feifan-life/data.json');
  assert.notEqual(storagePaths('.settings','feifan-life').dataDir,storagePaths('.settings','other-tool').dataDir);
  for(const path of ['/tmp/settings','../settings','x/../settings','C:/settings'])assert.throws(()=>storagePaths(path,'feifan-life'));
});

test('user directories cannot escape the vault or access hidden plugin data',()=>{
  assert.equal(vaultRelativePath('My Notes/Reviews'),'My Notes/Reviews');
  assert.equal(vaultRelativePath('',true),'');
  for(const path of ['','/tmp/private','../private','Notes/../private','.settings/plugins/private','https://example.com/image.png','C:\\private'])assert.throws(()=>vaultRelativePath(path));
});
