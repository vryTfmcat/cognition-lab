import unicodeManifest from "./unicode.json";
export type Family = "polygon" | "smooth" | "mixed";
export type Difficulty = number | "easy" | "standard" | "hard";
export function difficultyLabel(value: Difficulty): string {
  return typeof value === "number" ? `${value}%` : ({easy:"简单（旧版）",standard:"标准（旧版）",hard:"困难（旧版）"}[value]);
}
export function difficultyProfile(value: Difficulty) {
  if (typeof value !== "number") return difficultyProfiles[value];
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error("难度须在0%至100%之间");
  // Continuous geometry: each percentage reduces radial displacement, without tier thresholds.
  return {changes:3, delta:Number((12 - value * .105).toFixed(4))};
}
export const difficultyProfiles = {easy: {changes: 3, delta: 12}, standard: {changes: 2, delta: 8}, hard: {changes: 1, delta: 4}} as const;
export const familyNames: Record<Family, string> = {
  polygon: "凹多边形",
  smooth: "圆滑轮廓",
  mixed: "直曲混合",
};
export type Point = [number, number];
export type Shape = {
  family: Family;
  points: Point[];
  path: string;
  area: number;
  perimeter: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
};
export type Display = { text?: string; grid?: string[][]; shape?: Shape };
export type Option = { id: string; display: Display };
export type Task = {
  id: string;
  version: string;
  group: string;
  title: string;
  prompt: string;
  material: Display;
  hide: boolean;
  exposureMs: number;
  options: Option[];
  correctId: string;
  explanation: string;
  stimulus?: Stimulus;
  unicodeIds?: string[];
};
export type Stimulus = {
  id: string;
  family: Family;
  seed: number;
  generatorVersion: string;
  rngVersion: string;
  config: { vertices: number; localChange: number; difficulty?: Difficulty; changedPoints?: number };
  target: Shape;
  distractors: Shape[];
  optionOrder: string[];
  validation: { unique: boolean; simple: boolean; normalized: boolean };
};
export const strategies = [
  ["visual", "整体外观"],
  ["verbal", "默念与语言"],
  ["structural", "结构特征"],
  ["relational", "位置与关系"],
  ["motor", "想象描画"],
  ["mixed", "混合方式"],
  ["guess", "猜测"],
  ["other", "其他 / 无法确定"],
] as const;
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle<T>(items: T[], seed: number): T[] {
  const random = rng(seed),
    out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const n = (x: number) => Number(x.toFixed(4));
export function samplePath(family: Family, points: Point[]): Point[] {
  if (family === "polygon") return points;
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const p0 = points[(i + points.length - 1) % points.length],
      p1 = points[i],
      p2 = points[(i + 1) % points.length],
      p3 = points[(i + 2) % points.length];
    for (let s = 0; s < 24; s++) {
      const t = s / 24;
      if (family === "mixed" && i % 2 === 0) {
        out.push([p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])]);
        continue;
      }
      const value = (k: 0 | 1) =>
        0.5 *
        (2 * p1[k] +
          (-p0[k] + p2[k]) * t +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t +
          (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t);
      out.push([value(0), value(1)]);
    }
  }
  return out;
}
export function isSimple(points: Point[]) {
  const cross = (a: Point, b: Point, c: Point) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < points.length; i++)
    for (let j = i + 2; j < points.length; j++) {
      if (i === 0 && j === points.length - 1) continue;
      const a = points[i],
        b = points[(i + 1) % points.length],
        c = points[j],
        d = points[(j + 1) % points.length];
      if (
        cross(a, b, c) * cross(a, b, d) < 0 &&
        cross(c, d, a) * cross(c, d, b) < 0
      )
        return false;
    }
  return true;
}
export function renderShape(family: Family, points: Point[]): Shape {
  let path = `M ${points[0].join(" ")}`;
  for (let i = 0; i < points.length; i++) {
    const p0 = points[(i + points.length - 1) % points.length],
      p1 = points[i],
      p2 = points[(i + 1) % points.length],
      p3 = points[(i + 2) % points.length];
    if (family === "polygon" || (family === "mixed" && i % 2 === 0))
      path += ` L ${p2.join(" ")}`;
    else
      path += ` C ${n(p1[0] + (p2[0] - p0[0]) / 6)} ${n(p1[1] + (p2[1] - p0[1]) / 6)} ${n(p2[0] - (p3[0] - p1[0]) / 6)} ${n(p2[1] - (p3[1] - p1[1]) / 6)} ${p2.join(" ")}`;
  }
  path += " Z";
  const sampled = samplePath(family, points);
  let area = 0,
    perimeter = 0;
  sampled.forEach((p, i) => {
    const q = sampled[(i + 1) % sampled.length];
    area += p[0] * q[1] - q[0] * p[1];
    perimeter += Math.hypot(p[0] - q[0], p[1] - q[1]);
  });
  const bounds = {
    minX: n(Math.min(...sampled.map((p) => p[0]))),
    minY: n(Math.min(...sampled.map((p) => p[1]))),
    maxX: n(Math.max(...sampled.map((p) => p[0]))),
    maxY: n(Math.max(...sampled.map((p) => p[1]))),
  };
  return {
    family,
    points,
    path,
    bounds,
    area: n(Math.abs(area) / 2),
    perimeter: n(perimeter),
  };
}
export function generate(family: Family, seed: number, difficulty: Difficulty = 100): Stimulus {
  const profile = difficultyProfile(difficulty);
  const random = rng(seed),
    count = family === "smooth" ? 8 : 6 + Math.floor(random() * 7);
  const points: Point[] = Array.from({ length: count }, (_, i) => {
    const a = (i * 2 * Math.PI) / count - 0.7;
    const r =
      i % 2 === 0
        ? (family === "polygon" ? 15 : 25) +
          random() * (family === "polygon" ? 2 : 4)
        : 37 + random() * 4;
    return [n(50 + Math.cos(a) * r), n(50 + Math.sin(a) * r)];
  });
  // All variants keep the same coordinate frame, direction, topology and vertex count.
  const target = renderShape(family, points),
    distractors = [0, 1, 2].map((v) => {
      const ps = points.map((p) => [...p] as Point);
      for(let j=0;j<profile.changes;j++) {
        const candidates = Array.from({length:count},(_,i)=>i).filter(i=>![1,2,3].includes(i));
        const i = profile.changes === 1 ? (2 + v * 2) % count : candidates[(v+j)%candidates.length], p=ps[i];
        const a=Math.atan2(p[1]-50,p[0]-50),r=Math.hypot(p[0]-50,p[1]-50);
        const delta=r>30 ? -profile.delta : ((profile.changes===1 ? v===1 : (v+j)%2===1) ? -profile.delta : profile.delta);
        ps[i]=[n(p[0]+Math.cos(a)*delta),n(p[1]+Math.sin(a)*delta)];
      }
      return renderShape(family, ps);
    });
  const all = [target, ...distractors],
    unique = all.every((s, i) =>
      all
        .slice(i + 1)
        .every((t) =>
          s.points.some(
            (p, k) =>
              Math.hypot(p[0] - t.points[k][0], p[1] - t.points[k][1]) > 0.01,
          ),
        ),
    );
  const simple = all.every((s) => isSimple(samplePath(family, s.points)));
  if (
    !simple ||
    !unique ||
    (family === "polygon" && !all.every((s) => hasConcavity(s.points)))
  )
    throw new Error(`Invalid stimulus: ${family}/${seed}`);
  return {
    id: `${family}-${difficulty}-${seed}`,
    family,
    seed,
    generatorVersion: typeof difficulty === "number" ? "shape-v1.2.0" : "shape-v1.1.0",
    rngVersion: "mulberry32-v1",
    config: { vertices: count, localChange: profile.delta, difficulty, changedPoints: profile.changes },
    target,
    distractors,
    optionOrder: shuffle(["target", "d1", "d2", "d3"], seed + 73),
    validation: { unique, simple, normalized: true },
  };
}
export function hasConcavity(points: Point[]): boolean {
  const turns = points.map((p, i) => {
    const q = points[(i + 1) % points.length],
      r = points[(i + 2) % points.length];
    return (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]);
  });
  return turns.some((t) => t < -0.001) && turns.some((t) => t > 0.001);
}
export function shapeTask(family: Family, seed: number, index: number, difficulty: Difficulty = 0): Task {
  const stimulus = generate(family, seed, difficulty),
    shapes = [stimulus.target, ...stimulus.distractors];
  const options = stimulus.optionOrder.map((id) => ({
    id,
    display: { shape: shapes[["target", "d1", "d2", "d3"].indexOf(id)] },
  }));
  return {
    id: `shape-${index}`,
    version: "recognition-v1.2",
    group: familyNames[family],
    title: "记住这个轮廓",
    prompt: "哪一个与刚才的图形完全相同？",
    material: { shape: stimulus.target },
    hide: true,
    exposureMs: 10000,
    options,
    correctId: "target",
    stimulus,
    explanation: `正确选项保留原图的全部几何参数；${difficultyLabel(difficulty)}难度的干扰项改变${stimulus.config.changedPoints}处轮廓，差异幅度${stimulus.config.localChange}。`,
  };
}
export type Row = {
  taskId: string;
  selectedId: string;
  correct: boolean;
  responseMs: number;
  exposureMs: number;
  strategies: string[];
  description: string;
  interrupted: boolean;
  repeatedExposure: number;
  usedAid: string;
  display: { width: number; height: number; stimulusSize: number };
  completedAt: string;
  runnerVersion?: string;
  strategyTiming?: string;
};
export type Session = {
  schemaVersion: "1.0";
  id: string;
  kind: string;
  label: string;
  mode: "practice" | "test";
  difficulty?: Difficulty;
  questionCount?: number;
  runnerVersion?: string;
  strategyTiming?: string;
  batch: string;
  createdAt: string;
  tasks: Task[];
  index: number;
  phase: string;
  rows: Row[];
  current: {
    selectedId: string;
    responseMs: number;
    exposureMs: number;
    interrupted: boolean;
    repeatedExposure: number;
    stimulusSize?: number;
  };
  draft?: { strategies: string[]; description: string; aid: string };
  familiarity: Record<string, string>;
  completed: boolean;
  feedback: string;
  aid: string;
};
export const emptyCurrent = () => ({
  selectedId: "",
  responseMs: 0,
  exposureMs: 0,
  interrupted: false,
  repeatedExposure: 0,
});
export const normalRow = (r: Row) =>
  !r.interrupted && r.repeatedExposure === 0 && r.usedAid === "没有";
export function groups(s: Session) {
  return [...new Set(s.tasks.map((t) => t.group))].map((group) => {
    const rs = s.rows.filter(
        (r) => s.tasks.find((t) => t.id === r.taskId)?.group === group,
      ),
      clean = ["有", "不确定"].includes(s.aid) ? [] : rs.filter(normalRow);
    return {
      group,
      count: rs.length,
      correct: rs.filter((r) => r.correct).length,
      normal: clean.length,
      meanMs: clean.length
        ? clean.reduce((a, r) => a + r.responseMs, 0) / clean.length
        : null,
    };
  });
}
export function csv(s: Session) {
  const fields = [
    "session_id",
    "mode",
    "question_count",
    "difficulty",
    "runner_version",
    "strategy_timing",
    "session_aid",
    "task_version",
    "batch",
    "task_id",
    "group",
    "seed",
    "selected_id",
    "correct_id",
    "correct",
    "response_ms",
    "exposure_ms",
    "strategies",
    "description",
    "interrupted",
    "repeated_exposure",
    "used_aid",
    "display",
    "font_version",
    "generator_version",
    "rng_version",
    "option_order",
    "familiarity",
    "completed_at",
  ];
  const esc = (v: unknown) => {
    let str = String(v ?? "");
    if (/^[=+@-]/.test(str)) str = "'" + str;
    return '"' + str.replaceAll('"', '""') + '"';
  };
  return (
    "\ufeff" +
    [
      fields,
      ...s.rows.map((r) => {
        const t = s.tasks.find((t) => t.id === r.taskId)!;
        return [
          s.id,
          s.mode,
          s.tasks.length,
          s.difficulty ?? "legacy",
          r.runnerVersion ?? s.runnerVersion ?? "legacy",
          r.strategyTiming ?? s.strategyTiming ?? "after-answer",
          s.aid,
          t.version,
          s.batch,
          r.taskId,
          t.group,
          t.stimulus?.seed,
          r.selectedId,
          t.correctId,
          r.correct,
          r.responseMs,
          r.exposureMs,
          r.strategies.join("|"),
          r.description,
          r.interrupted,
          r.repeatedExposure,
          r.usedAid,
          JSON.stringify(r.display),
          t.unicodeIds
            ? JSON.stringify(
                unicodeManifest
                  .filter((u) => t.unicodeIds?.includes(u.symbol_id))
                  .map((u) => ({
                    id: u.symbol_id,
                    font: u.font,
                    version: u.font_version,
                  })),
              )
            : "",
          t.stimulus?.generatorVersion,
          t.stimulus?.rngVersion,
          JSON.stringify(t.options.map((o) => o.id)),
          JSON.stringify(s.familiarity),
          r.completedAt,
        ];
      }),
    ]
      .map((row) => row.map(esc).join(","))
      .join("\r\n")
  );
}
