import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeSession,maximumCount} from './bank';

test('selectable counts produce unique tasks, balanced mixed families, and reproducible saved rounds',()=>{
  for(const kind of ['quick','twelve','position-recall','change-location','spatial-pairing','reverse-rebuild','unicode','unicode-geometry','unicode-math','unicode-arrows','unicode-script','mixed','polygon','smooth','curve']) {
    for(const count of [1,2,maximumCount(kind)]) {
      const s=makeSession(kind,'test',20261014,0,count);
      assert.equal(s.tasks.length,count);assert.equal(s.questionCount,count);
      assert.equal(new Set(s.tasks.map(t=>t.id)).size,count);
      assert.deepEqual(s.tasks,makeSession(kind,'test',20261014,0,count).tasks);
      assert.deepEqual(JSON.parse(JSON.stringify(s)).tasks,s.tasks);
      for(const t of s.tasks) assert.equal(t.options.filter(o=>o.id===t.correctId).length,1);
      if(kind==='mixed') {
        const counts=['polygon','smooth','mixed'].map(f=>s.tasks.filter(t=>t.stimulus?.family===f).length);
        assert.ok(Math.max(...counts)-Math.min(...counts)<=1);
      }
    }
    for(const count of [0,-1,1.5,maximumCount(kind)+1])assert.throws(()=>makeSession(kind,'test',1,0,count));
  }
});
