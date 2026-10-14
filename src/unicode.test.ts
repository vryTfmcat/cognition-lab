import {test} from 'node:test';
import assert from 'node:assert/strict';
import {unicode, unicodeBank, unicodeCategories, makeSession} from './bank';

test('all five Unicode rounds support 30 unique seeded sequences and one unambiguous answer',()=>{
  for(const kind of ['unicode',...Object.keys(unicodeCategories)]) {
    for(let seed=0;seed<20;seed++) {
      const tasks=unicodeBank(seed,30,kind);
      assert.equal(tasks.length,30);
      assert.deepEqual(tasks,unicodeBank(seed,30,kind));
      assert.equal(new Set(tasks.map(t=>t.material.text)).size,30);
      for(const t of tasks) {
        assert.equal(t.version,'unicode-pilot-v2.0');
        assert.equal(t.exposureMs,10000);
        assert.equal(new Set(t.options.map(o=>o.display.text)).size,4);
        assert.equal(t.options.filter(o=>o.display.text===t.material.text).length,1);
        assert.equal(t.options.find(o=>o.id===t.correctId)?.display.text,t.material.text);
        assert.equal(t.unicodeIds?.length,5);
        const pool=unicode.filter(u=>t.unicodeIds?.includes(u.symbol_id));
        for(const display of [t.material,...t.options.map(o=>o.display)]) {
          const chars=display.text!.split(' ');
          assert.equal(chars.length,4);assert.equal(new Set(chars).size,4);
          assert.ok(chars.every(c=>pool.some(u=>u.char===c)));
        }
        if(unicodeCategories[kind])assert.ok(pool.every(u=>u.category===unicodeCategories[kind]));
      }
    }
    const session=makeSession(kind,'test',20261014,0,30);
    assert.equal(session.tasks.length,30);
    assert.equal(session.batch,'frozen-20261015-unicode-v2');
    assert.deepEqual(JSON.parse(JSON.stringify(session)).tasks,session.tasks);
  }
  assert.equal(makeSession('unicode','practice',10).tasks.length,12);
  for(const count of [0,31,1.5])assert.throws(()=>unicodeBank(1,count));
});
