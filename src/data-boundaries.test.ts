import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { makeSession } from "./bank";
import { csv, groups, normalRow, type Session } from "./core";
import { KEY, HISTORY, SAVE_WARNING, loadRecords, saveSession, saveHistory, interruptedSession, retrySession, clearRecords, type RecordStorage } from "./storage";

function storageWith(data: Map<string, string>): RecordStorage {
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: key => { data.delete(key); },
  };
}
function recordedSession(): Session {
  const s = makeSession("quick", "test", 20261014);
  s.rows = s.tasks.map((t,i) => ({
    taskId:t.id, selectedId:t.options[i].id, correct:t.options[i].id===t.correctId,
    responseMs:1000+i*123, exposureMs:10000, strategies:["visual","structural"],
    description:'保留外观, "凹口"\n下一行', interrupted:i===1,repeatedExposure:i===2?2:0,
    usedAid:"没有",display:{width:390,height:844,stimulusSize:132},completedAt:"2026-10-14T00:00:00Z",
  }));
  return {...s,completed:true,phase:"results",aid:"没有"};
}
// Small RFC4180 reader exercises the exported file, including commas/newlines/quotes.
function parseCsv(text:string):string[][] {
  const rows:string[][]=[];let row:string[]=[],cell="",quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&c===','){row.push(cell);cell="";}else if(!quoted&&c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell="";}else cell+=c;}
  row.push(cell);rows.push(row);rows[0][0]=rows[0][0].replace(/^\ufeff/,'');return rows;
}
test("read denied or corrupt session is reported and never deletes saved records",()=>{
  const data=new Map([[KEY,'old-session'],[HISTORY,'[]'],['other-app','keep']]);
  const storage=storageWith(data);
  const denied={...storage,getItem(){throw new DOMException('denied','SecurityError');}};
  const loaded=loadRecords(()=>denied);
  assert.equal(loaded.sessionReadable,false);assert.equal(loaded.historyReadable,false);
  assert.ok(loaded.error.includes('读取失败'));assert.equal(saveSession(()=>denied,null,loaded.sessionReadable), '');assert.equal(data.get(KEY),'old-session');assert.equal(data.get('other-app'),'keep');
  const invalid=loadRecords(()=>storage);assert.equal(invalid.sessionReadable,false);assert.equal(data.get(KEY),'old-session');
});
test("quota write failure leaves in-memory results exportable and prior history intact",()=>{
  const s=recordedSession(), data=new Map([[HISTORY,'previous-history']]);
  const denied={...storageWith(data),setItem(_key:string,_value:string){throw new DOMException('full','QuotaExceededError');}};
  assert.equal(saveSession(()=>denied,s,true), SAVE_WARNING);assert.ok(saveHistory(()=>denied,[s],true).includes('复制文本'));assert.equal(data.get(HISTORY),'previous-history');
  assert.ok(saveHistory(()=>storageWith(data),[s],false));assert.equal(data.get(HISTORY),'previous-history');
  assert.equal(JSON.parse(JSON.stringify(s)).rows.length,3);assert.equal(parseCsv(csv(s)).length,4);
  assert.ok(SAVE_WARNING.includes('复制文本')&&SAVE_WARNING.includes('关闭页面将无法恢复'));

});
test("refresh/visibility recovery keeps every shape and option identity across repeated exposures",()=>{
  for(const phase of ['observe','answer']){
    const original=makeSession('mixed','test',20261014);original.phase=phase;
    const storage=storageWith(new Map([[KEY,JSON.stringify(original)],[HISTORY,'[]']]));
    const loaded=loadRecords(()=>storage).session!;
    assert.equal(loaded.phase,'interrupted');assert.equal(loaded.current.interrupted,true);
    assert.deepEqual(loaded.tasks,original.tasks);assert.equal(loaded.current.repeatedExposure,0);
    const retry=retrySession(loaded);assert.equal(retry.current.repeatedExposure,1);assert.equal(retry.tasks,loaded.tasks);
    const again=retrySession(interruptedSession(retry));assert.equal(again.current.repeatedExposure,2);
    assert.equal(again.tasks,retry.tasks);assert.equal(again.index,original.index);
    const s=recordedSession();s.rows[0]={...s.rows[0],...again.current,responseMs:777};
    assert.equal(normalRow(s.rows[0]),false);assert.equal(groups(s)[0].meanMs,null);
  }
});
test("CSV parsed rows match JSON and result aggregates for both fixture and existing browser exports",()=>{
  const check=(s:Session,text:string)=>{
    const [head,...rows]=parseCsv(text);assert.equal(rows.length,s.rows.length);
    const value=(row:string[],field:string)=>row[head.indexOf(field)];
    rows.forEach((row,i)=>{const r=s.rows[i],t=s.tasks.find(t=>t.id===r.taskId)!;
      assert.equal(value(row,'session_id'),s.id);assert.equal(value(row,'task_id'),r.taskId);
      assert.equal(value(row,'selected_id'),r.selectedId);assert.equal(value(row,'correct_id'),t.correctId);
      assert.equal(value(row,'correct'),String(r.correct));assert.equal(Number(value(row,'response_ms')),r.responseMs);
      assert.equal(Number(value(row,'exposure_ms')),r.exposureMs);assert.equal(value(row,'strategies'),r.strategies.join('|'));
      assert.equal(value(row,'description'),r.description);assert.equal(value(row,'interrupted'),String(r.interrupted));
      assert.equal(Number(value(row,'repeated_exposure')),r.repeatedExposure);assert.equal(value(row,'used_aid'),r.usedAid);
      assert.deepEqual(JSON.parse(value(row,'display')),r.display);
    });
    for(const g of groups(s)){const rs=s.rows.filter(r=>s.tasks.find(t=>t.id===r.taskId)?.group===g.group);
      assert.equal(g.count,rs.length);assert.equal(g.correct,rs.filter(r=>r.correct).length);
      const clean=['有','不确定'].includes(s.aid)?[]:rs.filter(normalRow);assert.equal(g.normal,clean.length);
      assert.equal(g.meanMs,clean.length?clean.reduce((sum,r)=>sum+r.responseMs,0)/clean.length:null);
    }
  };
  const s=recordedSession();check(JSON.parse(JSON.stringify(s)),csv(s));
  const name='形迹-4fcff02a-483a-4172-8321-74f225eb3b21';
  if (existsSync(new URL('../qa/'+name+'.json',import.meta.url)) && existsSync(new URL('../qa/'+name+'.csv',import.meta.url))) {
    check(JSON.parse(readFileSync(new URL('../qa/'+name+'.json',import.meta.url),'utf8')),readFileSync(new URL('../qa/'+name+'.csv',import.meta.url),'utf8'));
  }
});
test("clear is limited to named record keys, restores after second removal fails, and reports rollback failure",()=>{
  const entries:[[string,string],[string,string],[string,string]]=[[KEY,'current'],[HISTORY,'round-1-and-round-2'],['other-app','keep']];
  const data=new Map(entries),storage=storageWith(data);
  assert.equal(clearRecords(storage).ok,true);assert.deepEqual([...data],[['other-app','keep']]);
  for(const [k,v] of entries)data.set(k,v);
  const partial={...storage,removeItem(key:string){if(key===HISTORY)throw Error('blocked');storage.removeItem(key);}};
  const failure=clearRecords(partial);assert.equal(failure.ok,false);assert.ok(failure.error.includes('已恢复'));assert.equal(data.get(KEY),'current');assert.equal(data.get(HISTORY),'round-1-and-round-2');assert.equal(data.get('other-app'),'keep');
  const failedRollback=clearRecords({...partial,setItem(){throw Error('quota');}});
  assert.equal(failedRollback.ok,false);assert.ok(failedRollback.error.includes('部分本地记录已移除且恢复失败'));assert.equal(data.get(HISTORY),'round-1-and-round-2');assert.equal(data.get('other-app'),'keep');
  const before=new Map(data);assert.equal(clearRecords({...storage,getItem(){throw Error('read denied');}}).ok,false);assert.deepEqual(data,before);
});

// Only the unfinished round may be removed; completed history and other origins' keys stay intact.
test('ending an unfinished round preserves history and rejects a changed or failed storage record', async () => {
  const {endUnfinishedSession}=await import('./storage');
  const s=makeSession('quick','practice',123), history=JSON.stringify([recordedSession()]);
  const data=new Map([[KEY,JSON.stringify(s)],[HISTORY,history],['other-app','keep']]),storage=storageWith(data);
  assert.equal(endUnfinishedSession(()=>storage,s.id).ok,true);
  assert.equal(data.has(KEY),false);assert.equal(data.get(HISTORY),history);assert.equal(data.get('other-app'),'keep');
  const next=makeSession('twelve','practice',456);assert.equal(saveSession(()=>storage,next,true),'');
  assert.equal(loadRecords(()=>storage).session?.kind,'twelve');assert.equal(data.get(HISTORY),history);
  const before=data.get(KEY);assert.equal(endUnfinishedSession(()=>storage,s.id).ok,false);assert.equal(data.get(KEY),before);
  assert.equal(endUnfinishedSession(()=>({...storage,removeItem(){throw Error('denied');}}),next.id).ok,false);assert.equal(data.get(KEY),before);
  data.set(KEY,JSON.stringify({...next,completed:true}));assert.equal(endUnfinishedSession(()=>storage,next.id).ok,false);
});

test('legacy shared sample resumes at its experiment introduction without changing records',()=>{
  const s=makeSession('twelve','practice',42);s.phase='sample';
  const history=JSON.stringify([recordedSession()]),data=new Map([[KEY,JSON.stringify(s)],[HISTORY,history]]);
  const loaded=loadRecords(()=>storageWith(data));
  assert.equal(loaded.session?.phase,'intro');assert.equal(loaded.session?.kind,'twelve');
  assert.deepEqual(loaded.session?.tasks,s.tasks);assert.deepEqual(loaded.session?.rows,s.rows);
  assert.equal(data.get(HISTORY),history);assert.equal(JSON.parse(data.get(KEY)!).phase,'sample');
});
