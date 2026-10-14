import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generate,
  hasConcavity,
  samplePath,
  isSimple,
  shuffle,
  normalRow,
  groups,
  csv,
  type Family,
} from "./core";
import {
  twelveBank,
  quickBank,
  rotate,
  mirror,
  makeSession,
  unicode,
} from "./bank";
test("three families: 100 seeds each, deterministic geometry, distinct local distractors and simple paths", () => {
  for (const family of ["polygon", "smooth", "mixed"] as Family[])
    for (let seed = 0; seed < 100; seed++) {
      const s = generate(family, seed);
      assert.deepEqual(generate(family, seed), s);
      assert.ok(s.validation.unique && s.validation.simple);
      const all = [s.target, ...s.distractors];
      for (const v of all) {
        assert.equal(v.points.length, s.config.vertices);
        assert.ok(v.path.endsWith("Z"));
        assert.ok(v.area > 500 && v.perimeter > 100);
        if (family === "polygon") assert.ok(hasConcavity(v.points));
        const samples = samplePath(family, v.points);
        assert.ok(isSimple(samples));
        assert.ok(samples.every((p) => p.every((c) => c > 3 && c < 97)));
      }
      for (const d of s.distractors) {
        assert.equal(
          d.points.filter(
            (p, i) => JSON.stringify(p) !== JSON.stringify(s.target.points[i]),
          ).length,
          s.config.changedPoints,
        );
        assert.notEqual(d.path, s.target.path);
      }
    }
});
test("fixed banks: exactly one answer, shuffled stable IDs, correct new transforms and inverse operations", () => {
  const bank = twelveBank();
  assert.equal(bank.length, 12);
  assert.deepEqual(
    quickBank().map(
      (t) => t.options.find((o) => o.id === t.correctId)!.display.text,
    ),
    ["■ ▲ ■", "4 1 3", "K T R"],
  );
  for (const t of [...bank, ...quickBank()]) {
    assert.equal(t.options.filter((o) => o.id === t.correctId).length, 1);
    assert.equal(
      new Set(t.options.map((o) => JSON.stringify(o.display))).size,
      4,
    );
    for (let seed = 0; seed < 20; seed++)
      assert.equal(
        shuffle(t.options, seed).find((o) => o.id === t.correctId)?.display,
        t.options.find((o) => o.id === t.correctId)?.display,
      );
  }
  const answer = (id: string) =>
    bank
      .find((t) => t.id === id)!
      .options.find((o) => o.id === bank.find((t) => t.id === id)!.correctId)!
      .display;
  for (const [id, transform] of [
    ["t1", (g: string[][]) => rotate(g)],
    ["t2", mirror],
    ["t3", (g: string[][]) => rotate(g, 2)],
  ] as const)
    assert.deepEqual(
      answer(id).grid,
      transform(bank.find((t) => t.id === id)!.material.grid!),
    );
  const initial = answer("i2").text!.split(" "),
    moved = [...initial.slice(1), initial[0]];
  [moved[1], moved[2]] = [moved[2], moved[1]];
  assert.equal(moved.join(" "), bank.find((t) => t.id === "i2")!.material.text);
  assert.deepEqual(
    rotate(mirror(answer("i3").grid!), 2),
    bank.find((t) => t.id === "i3")!.material.grid,
  );
});
test("Unicode pool is 30 standalone non-emoji codepoints, versioned and font-bound", () => {
  assert.equal(unicode.length, 30);
  assert.equal(new Set(unicode.map((u) => u.symbol_id)).size, 30);
  assert.deepEqual(
    new Set(unicode.map((u) => u.category)),
    new Set(["几何", "数学", "箭头", "陌生文字"]),
  );
  for (const u of unicode) {
    assert.equal(Array.from(u.char).length, 1);
    assert.equal(
      u.codepoint,
      `U+${u.char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`,
    );
    assert.equal(u.font_sha256.length, 64);
  }
});
test("frozen mixed batch balanced, reproducible, and practice seeds differ", () => {
  const s = makeSession("mixed", "test", 20261014),
    t = makeSession("mixed", "test", 20261014);
  assert.deepEqual(s.tasks, t.tasks);
  assert.deepEqual(
    Object.values(
      s.tasks.reduce(
        (a, t) => {
          a[t.group] = (a[t.group] || 0) + 1;
          return a;
        },
        {} as Record<string, number>,
      ),
    ),
    [3, 3, 3],
  );
  assert.notDeepEqual(
    makeSession("mixed", "practice", 1).tasks,
    makeSession("mixed", "practice", 2).tasks,
  );
});
test("interrupted, repeat-exposed and aided trials excluded from mean; CSV quotes multiline fields", () => {
  const s = makeSession("quick", "test", 1);
  s.rows = s.tasks.map((t, i) => ({
    taskId: t.id,
    selectedId: t.correctId,
    correct: true,
    responseMs: 1000,
    exposureMs: 10000,
    strategies: ["visual"],
    description: 'line 1, "quote"\nline 2',
    interrupted: i === 1,
    repeatedExposure: i === 2 ? 1 : 0,
    usedAid: "没有",
    display: { width: 390, height: 844, stimulusSize: 140 },
    completedAt: "2026-10-14",
  }));
  assert.equal(s.rows.filter(normalRow).length, 1);
  assert.equal(groups(s)[0].meanMs, 1000);
  assert.equal(groups(s)[1].meanMs, null);
  assert.ok(csv(s).includes('"line 1, ""quote""\nline 2"'));
  assert.equal(
    JSON.parse(JSON.stringify(s)).tasks[0].correctId,
    s.tasks[0].correctId,
  );
});
