import {test} from 'node:test';
import assert from 'node:assert/strict';
import {introKinds,introBank,makeSession} from './bank';

test('four intro types have unique materials, unambiguous independently computed answers, and stable restoration',()=>{
  for(const kind of introKinds)for(let seed=0;seed<30;seed++) {
    const tasks=introBank(kind,seed,30);
    assert.equal(tasks.length,30);
    assert.deepEqual(tasks,introBank(kind,seed,30));
    assert.equal(new Set(tasks.map(t=>JSON.stringify(t.material))).size,30);
    for(const task of tasks) {
      assert.equal(task.hide,true);assert.equal(task.exposureMs,10000);
      assert.equal(new Set(task.options.map(o=>JSON.stringify(o.display))).size,4);
      const q=Number(task.generation!.parameters.queryIndex);
      const seq=task.material.grid?.flat() ?? task.material.text!.split(' ');
      assert.equal(seq.length,4);assert.equal(new Set(seq).size,4);
      const correct=task.options.find(o=>o.id===task.correctId)!.display.text;
      if(kind==='position-recall'||kind==='spatial-pairing')assert.equal(correct,seq[q]);
      if(kind==='reverse-rebuild')assert.equal(correct,[...seq].reverse().join(' '));
      if(kind==='change-location') {
        const changed=task.answerMaterial!.text!.split(' ');
        const different=changed.map((c,i)=>c===seq[i]?-1:i).filter(i=>i>=0);
        assert.deepEqual(different,[q]);assert.equal(correct,`第${q+1}位`);
      }else assert.equal(task.answerMaterial,undefined);
    }
    const session=makeSession(kind,'test',seed,0,30);
    assert.equal(session.batch,'frozen-20261015-intro-v1');
    for(const task of session.tasks)assert.deepEqual(task.options.find(o=>o.id===task.correctId)?.display,tasks.find(t=>t.id===task.id)?.options.find(o=>o.id===task.correctId)?.display);
    assert.deepEqual(JSON.parse(JSON.stringify(session)).tasks,session.tasks);
  }
});

test('new Unicode rounds mark familiarity as optional without inventing missing responses',()=>{
  for(const kind of ['unicode','unicode-geometry','unicode-math','unicode-arrows','unicode-script']) {
    const s=makeSession(kind,'practice',1,0,1);
    assert.equal(s.familiarityPolicy,'optional');assert.deepEqual(s.familiarity,{});
  }
});
