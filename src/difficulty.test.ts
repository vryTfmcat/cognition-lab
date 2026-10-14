import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generate,isSimple,samplePath,hasConcavity,difficultyProfile,csv,type Family,type Difficulty} from './core';
import {makeSession} from './bank';
import {loadRecords,retrySession,interruptedSession,KEY,HISTORY} from './storage';

test('percentage difficulty keeps valid unique geometry at endpoints and intermediate values',()=>{
  for(const family of ['polygon','smooth','mixed'] as Family[])for(let seed=0;seed<100;seed++) {
    let previous=Infinity;
    for(const difficulty of [0,25,50,75,100] as Difficulty[]) {
      const s=generate(family,seed,difficulty),profile=difficultyProfile(difficulty);
      assert.deepEqual(s,generate(family,seed,difficulty));
      assert.equal(new Set([s.target,...s.distractors].map(x=>x.path)).size,4);
      for(const shape of [s.target,...s.distractors]) {
        assert.equal(shape.points.length,s.target.points.length);
        assert.ok(isSimple(samplePath(family,shape.points)));
        assert.ok(shape.area>500);if(family==='polygon')assert.ok(hasConcavity(shape.points));
        assert.ok(samplePath(family,shape.points).every(p=>p.every(n=>n>3&&n<97)));
      }
      let distance=0;
      for(const shape of s.distractors) {
        assert.equal(shape.points.filter((p,i)=>Math.hypot(p[0]-s.target.points[i][0],p[1]-s.target.points[i][1])>.01).length,profile.changes);
        distance+=shape.points.reduce((sum,p,i)=>sum+Math.hypot(p[0]-s.target.points[i][0],p[1]-s.target.points[i][1]),0);
      }
      assert.ok(distance<previous);previous=distance;
    }
  }
});
test('difficulty is frozen per round, exported, and preserved together with optional in-observation notes after interruption',()=>{
  for(const difficulty of [0,25,50,75,100] as Difficulty[]) {
    const s=makeSession('mixed','test',20261014,difficulty);
    assert.equal(s.difficulty,difficulty);assert.ok(s.batch.endsWith(String(difficulty)));
    assert.equal(s.runnerVersion,'runner-v2-inline-optional');
    assert.deepEqual(s.tasks,makeSession('mixed','test',20261014,difficulty).tasks);
    for(const t of s.tasks){assert.equal(t.stimulus?.config.difficulty,difficulty);assert.deepEqual(t.options.find(o=>o.id===t.correctId)?.display.shape,t.stimulus?.target);}
    s.phase='observe';s.draft={strategies:['visual'],description:'记住大凹口',aid:'没有'};
    const saved=JSON.stringify(s),store={getItem:(key:string)=>key===KEY?saved:key===HISTORY?'[]':null,setItem(){},removeItem(){}};
    const restored=retrySession(loadRecords(()=>store).session!);
    assert.deepEqual(restored.draft,s.draft);assert.deepEqual(restored.tasks,s.tasks);assert.equal(restored.difficulty,difficulty);
    assert.equal(interruptedSession(restored).current.interrupted,true);
    const task=s.tasks[0];s.rows=[{taskId:task.id,selectedId:task.correctId,correct:true,responseMs:800,exposureMs:10000,strategies:[],description:'',interrupted:false,repeatedExposure:0,usedAid:'没有',display:{width:390,height:844,stimulusSize:132},completedAt:new Date().toISOString()}];
    assert.equal(s.rows[0].strategies.length,0);assert.ok(csv(s).includes(`"${difficulty}"`));assert.ok(csv(s).includes('"during-observation-or-answer"'));
  }
  assert.equal(makeSession('polygon','practice',10).difficulty,0);
});

test('every percentage changes actual geometry continuously and monotonically',()=>{
  for(const family of ['polygon','smooth','mixed'] as Family[]) {
    let previous=Infinity;
    for(let difficulty=0;difficulty<=100;difficulty++) {
      const s=generate(family,73,difficulty);
      const distance=s.distractors.reduce((total,shape)=>total+shape.points.reduce((sum,p,i)=>sum+Math.hypot(p[0]-s.target.points[i][0],p[1]-s.target.points[i][1]),0),0);
      assert.ok(distance<previous);previous=distance;
      assert.equal(s.config.difficulty,difficulty);
    }
  }
  for(const invalid of [-1,101,NaN,Infinity])assert.throws(()=>generate('polygon',1,invalid));
});
