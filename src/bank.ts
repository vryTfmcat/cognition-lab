import {
  type Task,
  type Display,
  type Family,
  shuffle,
  shapeTask,
  emptyCurrent,
  type Session,
  type Difficulty,
} from "./core";
import unicode from "./unicode.json";
export { unicode };
export const kindLabels: Record<string, string> = {
  quick: "三题快速体验",
  twelve: "十二题 · 表征与操作",
  unicode: "Unicode 序列再认",
  "unicode-geometry": "几何字符序列",
  "unicode-math": "数学字符序列",
  "unicode-arrows": "箭头字符序列",
  "unicode-script": "陌生文字序列",
  mixed: "混合家族再认",
  polygon: "凹多边形练习",
  smooth: "圆滑轮廓练习",
  curve: "直曲混合练习",
};
const d = (text: string): Display => ({ text });
const grid = (rows: string[][]): Display => ({ grid: rows });
export function fixed(
  id: string,
  group: string,
  title: string,
  prompt: string,
  material: Display,
  choices: Display[],
  correct: number,
  explanation: string,
  hide = false,
  version = "operations-new-v1.0",
): Task {
  return {
    id,
    version,
    group,
    title,
    prompt,
    material,
    options: choices.map((display, i) => ({ id: `o${i}`, display })),
    correctId: `o${correct}`,
    exposureMs: hide ? 10000 : 0,
    hide,
    explanation,
  };
}
export function rotate(g: string[][], turns = 1): string[][] {
  const dirs = ["↑", "→", "↓", "←"];
  let out = g.map((r) => [...r]);
  for (let t = 0; t < turns; t++) {
    const rows = out.length,
      cols = out[0].length;
    out = Array.from({ length: cols }, (_, y) =>
      Array.from({ length: rows }, (_, x) => {
        const c = out[rows - 1 - x][y];
        return dirs.includes(c) ? dirs[(dirs.indexOf(c) + 1) % 4] : c;
      }),
    );
  }
  return out;
}
export function mirror(g: string[][]): string[][] {
  return g.map((r) =>
    [...r].reverse().map((c) => (c === "→" ? "←" : c === "←" ? "→" : c)),
  );
}
const qVersion = "three-memory-v1.1";
export function quickBank(): Task[] {
  return [
    fixed(
      "q1",
      "符号记忆",
      "观察符号顺序",
      "第 3、5、7 个图形分别是什么？",
      d("● ▲ ■ ◆ ▲ ● ■"),
      ["■ ▲ ■", "▲ ◆ ■", "■ ● ▲", "◆ ▲ ●"].map(d),
      0,
      "原序列第3、5、7位依次为 ■、▲、■。",
      true,
      qVersion,
    ),
    fixed(
      "q2",
      "数字记忆",
      "观察数字顺序",
      "倒数第 2、4、6 个数字依次是什么？",
      d("8 3 6 1 9 4 2"),
      ["4 1 3", "2 6 8", "4 6 3", "9 1 8"].map(d),
      0,
      "对应正向第6、4、2位，依次为4、1、3。",
      true,
      qVersion,
    ),
    fixed(
      "q3",
      "关联记忆",
      "记住符号与字母的对应",
      "◇、□、○ 分别对应什么字母？",
      grid([
        ["◇", "K"],
        ["△", "M"],
        ["○", "R"],
        ["□", "T"],
      ]),
      ["K T R", "M T K", "K R T", "R M T"].map(d),
      0,
      "◇ 对应K，□ 对应T，○ 对应R。",
      true,
      qVersion,
    ),
  ];
}
export function twelveBank(): Task[] {
  const arrows = [
      ["↑", "←"],
      ["↓", "→"],
    ],
    target = [
      ["→", "↑"],
      ["↓", "↑"],
    ],
    initial = mirror(rotate(target, 2));
  return [
    fixed(
      "m1",
      "记忆",
      "记住这组符号",
      "选择刚才的排列。",
      d("◇ ● □ ▲ ○"),
      ["◇ ● □ ▲ ○", "◇ □ ● ▲ ○", "◇ ● ▲ □ ○", "○ ● □ ▲ ◇"].map(d),
      0,
      "目标顺序为 ◇ ● □ ▲ ○。",
      true,
    ),
    fixed(
      "m2",
      "记忆",
      "记住符号的位置",
      "第 2、4、6 位分别是什么？",
      d("△ ■ ○ ◆ □ ●"),
      ["■ ◆ ●", "■ □ ●", "△ ◆ □", "○ ◆ ●"].map(d),
      0,
      "第2、4、6位为 ■、◆、●。",
      true,
    ),
    fixed(
      "m3",
      "记忆",
      "记住图形与位置",
      "选择刚才的位置布局。",
      grid([
        ["○", "△"],
        ["□", "◇"],
      ]),
      [
        grid([
          ["○", "△"],
          ["□", "◇"],
        ]),
        grid([
          ["△", "○"],
          ["□", "◇"],
        ]),
        grid([
          ["○", "△"],
          ["◇", "□"],
        ]),
        grid([
          ["□", "△"],
          ["○", "◇"],
        ]),
      ],
      0,
      "左上圆、右上三角、左下方形、右下菱形。",
      true,
    ),
    fixed(
      "t1",
      "变换",
      "整体顺时针旋转 90°",
      "同时旋转位置与箭头方向，结果是什么？",
      grid(arrows),
      [
        grid(rotate(arrows)),
        grid(arrows),
        grid(mirror(arrows)),
        grid(rotate(arrows, 2)),
      ],
      0,
      "位置顺时针转动，所有箭头方向也顺时针转90°。",
    ),
    fixed(
      "t2",
      "变换",
      "整体左右镜像",
      "左右位置对调，左右箭头也改变方向。",
      grid([["↑", "→", "←"]]),
      [
        grid(mirror([["↑", "→", "←"]])),
        grid([["←", "→", "↑"]]),
        grid([["↓", "←", "→"]]),
        grid([["↑", "←", "→"]]),
      ],
      0,
      "从左到右应为 →、←、↑。",
    ),
    fixed(
      "t3",
      "变换",
      "整体旋转 180°",
      "同时旋转位置与箭头方向，结果是什么？",
      grid([["↑", "→", "→"]]),
      [
        grid(rotate([["↑", "→", "→"]], 2)),
        grid([["→", "→", "↑"]]),
        grid([["↓", "←", "←"]]),
        grid([["←", "→", "↓"]]),
      ],
      0,
      "顺序反转且箭头反向，结果为 ←、←、↓。",
    ),
    fixed(
      "r1",
      "关系迁移",
      "规则：反转整个顺序",
      "保持每个符号形状不变，将下面序列反转。",
      d("□ △ ○ ◇"),
      ["◇ ○ △ □", "△ □ ○ ◇", "□ ○ △ ◇", "○ ◇ □ △"].map(d),
      0,
      "最后一项变成第一项，结果为 ◇ ○ △ □。",
    ),
    fixed(
      "r2",
      "关系迁移",
      "规则：循环左移一位",
      "第一项移到末尾，其余各项前移一位。",
      d("K M R T"),
      ["M R T K", "T K M R", "R T K M", "M K R T"].map(d),
      0,
      "K移动到末尾，结果为 M R T K。",
    ),
    fixed(
      "r3",
      "关系迁移",
      "规则：交换对角位置",
      "只交换左上与右下，其他位置不动。",
      grid([
        ["△", "□"],
        ["◇", "○"],
      ]),
      [
        grid([
          ["○", "□"],
          ["◇", "△"],
        ]),
        grid([
          ["□", "△"],
          ["◇", "○"],
        ]),
        grid([
          ["△", "◇"],
          ["□", "○"],
        ]),
        grid([
          ["○", "◇"],
          ["□", "△"],
        ]),
      ],
      0,
      "圆与三角交换，方形和菱形保持位置。",
    ),
    fixed(
      "i1",
      "可逆性",
      "撤销一次交换",
      "初始排列经过“交换前两位”后得到下面结果。初始是什么？",
      d("R K M"),
      ["K R M", "R M K", "M K R", "K M R"].map(d),
      0,
      "再交换前两位，即恢复 K R M。",
    ),
    fixed(
      "i2",
      "可逆性",
      "撤销两步操作",
      "初始排列先“循环左移一位”，再“交换末两位”，得到下面结果。初始是什么？",
      d("T R K"),
      ["R T K", "T K R", "K R T", "R K T"].map(d),
      0,
      "先撤销交换得到 T K R，再循环右移恢复 R T K。",
    ),
    fixed(
      "i3",
      "可逆性",
      "撤销镜像与旋转",
      "初始布局先“左右镜像”，再“整体旋转180°”，得到下面结果。初始是什么？",
      grid(target),
      [grid(initial), grid(target), grid(mirror(target)), grid(rotate(target))],
      0,
      "先撤销180°旋转，再撤销左右镜像；位置与方向都恢复。",
    ),
  ];
}
export const unicodeCategories: Record<string, string> = {
  "unicode-geometry": "几何", "unicode-math": "数学",
  "unicode-arrows": "箭头", "unicode-script": "陌生文字",
};
export function isUnicodeKind(kind: string) {
  return kind === "unicode" || Object.hasOwn(unicodeCategories, kind);
}
export function unicodeBank(seed: number, count = 12, kind = "unicode"): Task[] {
  if (!isUnicodeKind(kind) || !Number.isInteger(count) || count < 1 || count > 30)
    throw new Error("无效的Unicode轮次配置");
  const category = unicodeCategories[kind];
  const chars = category ? unicode.filter(c => c.category === category) : unicode;
  const seen = new Set<string>();
  return Array.from({ length: count }, (_, i) => {
    let pool: typeof unicode = [];
    // Retain seeded generation and reject repeated target sequences within a round.
    for (let attempt = 0; attempt < 1000; attempt++) {
      pool = shuffle(chars, seed + i * 1009 + attempt * 7919).slice(0, 5);
      const key = pool.slice(0, 4).map(c => c.symbol_id).join("|");
      if (!seen.has(key)) { seen.add(key); break; }
      if (attempt === 999) throw new Error("无法生成不重复的Unicode材料");
    }
    const
      seq = pool.slice(0, 4).map((c) => c.char);
    const variants = [
      seq,
      [seq[1], seq[0], seq[2], seq[3]],
      [seq[0], seq[1], seq[3], seq[2]],
      [seq[0], seq[1], pool[4].char, seq[3]],
    ];
    return {
      ...fixed(
        `u2-${kind}-${i + 1}`,
        category ? `Unicode · ${category}` : "Unicode · 混合",
        "记住字符顺序",
        "选择与刚才完全相同的字符序列。",
        d(seq.join(" ")),
        variants.map((v) => d(v.join(" "))),
        0,
        "正确选项的字符身份和排列顺序都与原序列一致。",
        true,
        "unicode-pilot-v2.0",
      ),
      unicodeIds: pool.map((c) => c.symbol_id),
    };
  });
}
export const demo = fixed(
  "demo",
  "样例",
  "先试一道不计分样例",
  "选择与刚才相同的排列。",
  d("○ △ □"),
  ["○ △ □", "△ ○ □", "○ □ △", "□ △ ○"].map(d),
  0,
  "目标顺序是圆、三角、方形。",
  true,
  "demo-v1",
);
export const defaultCounts: Record<string, number> = {quick:3,twelve:12,unicode:12,"unicode-geometry":6,"unicode-math":6,"unicode-arrows":6,"unicode-script":6,mixed:9,polygon:6,smooth:6,curve:6};
export function maximumCount(kind: string) { return kind === "quick" ? 3 : kind === "twelve" ? 12 : 30; }
export function makeSession(
  kind: string,
  mode: Session["mode"],
  seed: number,
  difficulty: Difficulty = 0,
  questionCount: number = defaultCounts[kind] ?? 6,
): Session {
  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > maximumCount(kind)) throw new Error("题数超出可选范围");
  let tasks: Task[];
  if (kind === "quick") tasks = quickBank();
  else if (kind === "twelve") tasks = twelveBank();
  else if (isUnicodeKind(kind)) tasks = unicodeBank(seed, questionCount, kind);
  else {
    const families: Family[] = kind === "mixed"
      ? shuffle(Array.from({length:questionCount},(_,i)=>(["polygon","smooth","mixed"] as Family[])[i%3]),seed)
      : Array(questionCount).fill(kind === "curve" ? "mixed" : kind);
    tasks = families.map((f, i) => shapeTask(f, seed + i * 107, i, difficulty));
  }
  if (tasks.length > questionCount) {
    const pool = tasks;
    tasks = Array.from({length:questionCount},(_,i)=>pool[Math.floor(i*pool.length/questionCount)]);
  }
  tasks = tasks.map((t, i) =>
    t.stimulus ? t : { ...t, options: shuffle(t.options, seed + i * 13) },
  );
  return {
    schemaVersion: "1.0",
    id: crypto.randomUUID(),
    kind,
    label: kindLabels[kind],
    mode,
    difficulty: tasks.some(t=>t.stimulus) ? difficulty : undefined,
    runnerVersion: "runner-v2-inline-optional",
    strategyTiming: "during-observation-or-answer",
    batch: (mode === "test" ? (isUnicodeKind(kind) ? "frozen-20261015-unicode-v2" : "frozen-20261014-v4") : `practice-${seed}`) + (tasks.some(t=>t.stimulus)?`-${difficulty}`:""),
    questionCount,
    createdAt: new Date().toISOString(),
    tasks,
    index: 0,
    phase: "intro",
    rows: [],
    current: emptyCurrent(),
    familiarity: {},
    completed: false,
    feedback: "",
    aid: "",
  };
}
