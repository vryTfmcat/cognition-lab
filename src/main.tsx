import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  type Display,
  type Session,
  type Task,
  type Family,
  strategies,
  familyNames,
  generate,
  emptyCurrent,
  groups,
  csv,
  normalRow,
  type Difficulty,
  difficultyLabel,
} from "./core";
import { kindLabels, makeSession, demo, unicode, defaultCounts, maximumCount } from "./bank";
import "./style.css";
import { loadRecords, saveSession, saveHistory, interruptedSession, retrySession, clearRecords, endUnfinishedSession } from "./storage";
function Visual({ value, small = false }: { value: Display; small?: boolean }) {
  const contentClass = value.shape
    ? "shape-visual"
    : value.grid
      ? "grid-visual"
      : "sequence-visual";
  return (
    <div className={`visual ${contentClass} ${small ? "small" : ""}`}>
      {value.shape ? (
        <svg viewBox="0 0 100 100" role="img" aria-label="待辨认的抽象轮廓">
          <path
            d={value.shape.path}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      ) : value.grid ? (
        <div
          className="symbol-grid"
          style={{ gridTemplateColumns: `repeat(${value.grid[0].length},1fr)` }}
        >
          {value.grid.flat().map((c, i) => (
            <span key={i}>{c}</span>
          ))}
        </div>
      ) : (
        <div className="symbol-sequence">
          {Array.from(value.text || "").map((c, i) => {
            const u = unicode.find((u) => u.char === c);
            return (
              <span
                key={i}
                style={u ? { fontFamily: `${u.font}, sans-serif` } : undefined}
              >
                {c}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
function Mark() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
      <path
        d="M5 8L18 3L25 14L19 26L6 23L11 15Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}
function Sample({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState("observe"),
    [seconds, setSeconds] = useState(3),
    [choice, setChoice] = useState("");
  useEffect(() => {
    if (stage !== "observe") return;
    const timer = setInterval(
      () => setSeconds((x) => Math.max(0, x - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [stage]);
  useEffect(() => {
    if (seconds === 0) setStage("answer");
  }, [seconds]);
  return (
    <>
      <p className="eyebrow">不计分样例</p>
      <h1>{stage === "observe" ? "先看，再回忆" : "试着选出刚才的排列"}</h1>
      <p className="muted">
        这是独立的操作样例，仅演示观察与选择，不计分、不保存实验记录。正式实验请从首页选择入口。
      </p>
      {stage === "observe" ? (
        <div className="stimulus">
          <Visual value={demo.material} />
          <p>观察剩余 {seconds} 秒</p>
        </div>
      ) : (
        <>
          <div className="choices">
            {demo.options.map((o, i) => (
              <button
                key={o.id}
                className={`choice ${choice === o.id ? "selected" : ""}`}
                onClick={() => setChoice(o.id)}
              >
                <span className="letter">{"ABCD"[i]}</span>
                <Visual value={o.display} small />
              </button>
            ))}
          </div>
          {choice && (
            <div className="notice">
              {choice === demo.correctId ? "选择正确。" : "原排列是 ○ △ □。"}{" "}
              正式题的记忆方式可在观察时选填，也可以留空。
            </div>
          )}
          <button className="primary" disabled={!choice} onClick={onDone}>
            完成样例，返回首页 <span>→</span>
          </button>
        </>
      )}
    </>
  );
}
function StrategyFields({ selectedStrategies, setSelectedStrategies, description, setDescription, aid, setAid }: {
  selectedStrategies:string[]; setSelectedStrategies:React.Dispatch<React.SetStateAction<string[]>>;
  description:string; setDescription:React.Dispatch<React.SetStateAction<string>>;
  aid:string; setAid:React.Dispatch<React.SetStateAction<string>>;
}) {
  return <section className="strategy-panel" data-strategy-form>
    <h2>你正在怎样记住或解题？ <small>选填</small></h2>
    <p className="muted">可在观察时勾选或写下做法，也可以全部留空。倒计时结束后仍可填写，原材料会按时隐藏。</p>
                <div className="strategy-list">
                  {strategies.map(([id, label]) => (
                    <label
                      key={id}
                      className={
                        selectedStrategies.includes(id) ? "checked" : ""
                      }
                    >
                      <input
                        type="checkbox"
                        checked={selectedStrategies.includes(id)}
                        onChange={() =>
                          setSelectedStrategies((s) =>
                            s.includes(id)
                              ? s.filter((x) => x !== id)
                              : [...s, id],
                          )
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <label className="field">
                  具体做法 <span>可选</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={2000}
                    placeholder="例如：我记住了左上角的凹口，然后想象沿着轮廓走一遍。"
                  />
                </label>
                <label className="field">
                  本题是否使用截图、笔记或其他辅助方式？
                  <select
                    value={aid}
                    onChange={(e) => setAid(e.target.value)}
                  >
                    <option>没有</option>
                    <option>有</option>
                    <option>不确定</option>
                  </select>
                </label>
</section>;
}

function App() {
  const [loaded] = useState(() => loadRecords(() => localStorage));
  const [session, setSession] = useState<Session | null>(loaded.session),
    [page, setPage] = useState("home"),
    [mode, setMode] = useState<Session["mode"]>("practice"),
    [difficulty, setDifficulty] = useState<number>(0),
    [questionCounts, setQuestionCounts] = useState<Record<string, string>>(() =>
      Object.fromEntries(
        Object.entries(defaultCounts).map(([kind, count]) => [kind, String(count)]),
      ),
    ),
    [section, setSection] = useState("intro"),
    [error, setError] = useState(loaded.error),
    [seconds, setSeconds] = useState(10),
    [selectedStrategies, setSelectedStrategies] = useState<string[]>(
      () => session?.draft?.strategies || [],
    ),
    [description, setDescription] = useState(
      () => session?.draft?.description || "",
    ),
    [aid, setAid] = useState(
      () => session?.draft?.aid || session?.aid || "没有",
    ),
    [confirmClear, setConfirmClear] = useState(false),
    [confirmEnd, setConfirmEnd] = useState(false),
    [pendingKind, setPendingKind] = useState<string | null>(null),
    [fallback, setFallback] = useState(false),
    [fontReady, setFontReady] = useState(false),
    [history, setHistory] = useState<Session[]>(loaded.history);
  const lastSession = useRef(session);
  const latest = useRef(session),
    observeStart = useRef(0),
    answerStart = useRef(0),
    materialRef = useRef<HTMLDivElement>(null);
  latest.current = session;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);
  useEffect(() => {
    if (!confirmClear && !confirmEnd) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setConfirmClear(false); setConfirmEnd(false); setPendingKind(null); }
      if (event.key === "Tab") {
        const buttons = Array.from(
          document.querySelectorAll<HTMLButtonElement>(".modal button"),
        );
        const first = buttons[0],
          last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmClear, confirmEnd]);
  useEffect(() => {
    if (
      page !== "run" &&
      session &&
      ["observe", "answer"].includes(session.phase)
    )
      setSession(interruptedSession(session));
  }, [page, session?.phase]);
  useEffect(() => {
    if (session && ["observe", "answer", "strategy"].includes(session.phase))
      setSession((s) =>
        s
          ? {
              ...s,
              draft: { strategies: selectedStrategies, description, aid },
            }
          : s,
      );
  }, [selectedStrategies, description, aid, session?.id, session?.index]);
  useEffect(() => {
    Promise.all(
      ["NotoSansSymbols2", "NotoSansMath", "NotoSansArmenian", "NotoSans"].map(
        (f) => document.fonts.load(`32px ${f}`),
      ),
    )
      .then(() => setFontReady(true))
      .catch(() => setError("实验字体未能加载，请刷新后重试。"));
  }, []);
  useEffect(() => {
    const warning = saveSession(() => localStorage, session, loaded.sessionReadable, !!lastSession.current);
    if (warning) setError(warning);
    lastSession.current = session;
  }, [session]);
  useEffect(() => {
    function interrupt() {
      const s = latest.current;
      if (!s || !["observe", "answer"].includes(s.phase)) return;
      if (materialRef.current) materialRef.current.style.visibility = "hidden";
      const next = interruptedSession(s);
      latest.current = next;
      const warning = saveSession(() => localStorage, next, loaded.sessionReadable);
      if (warning) setError(warning);
      setSession(next);
    }
    const visibility = () => {
      if (document.hidden) interrupt();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", interrupt);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", interrupt);
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    if (session.phase === "observe") {
      observeStart.current = performance.now();
      setSeconds(Math.ceil(session.tasks[session.index].exposureMs / 1000));
      const id = setInterval(() => {
        const elapsed = performance.now() - observeStart.current,
          target = session.tasks[session.index].exposureMs;
        setSeconds(Math.max(0, Math.ceil((target - elapsed) / 1000)));
        if (elapsed >= target) {
          clearInterval(id);
          setSession((s) =>
            s?.phase === "observe"
              ? {
                  ...s,
                  phase: "answer",
                  current: { ...s.current, exposureMs: Math.round(elapsed) },
                }
              : s,
          );
        }
      }, 50);
      return () => clearInterval(id);
    }
    if (session.phase === "answer") answerStart.current = performance.now();
  }, [session?.id, session?.index, session?.phase]);
  useEffect(() => {
    if (page === "run") {
      if (document.activeElement instanceof HTMLElement && document.activeElement.closest("[data-strategy-form]")) return;
      window.scrollTo(0, 0);
      document.querySelector<HTMLElement>(".runner h1")?.focus();
    }
  }, [page, session?.phase, session?.index]);
  const task = session?.tasks[session.index];
  function start(kind: string) {
    if (session && !session.completed) {
      requestEnd(kind);
      return;
    }
    launch(kind);
  }
  function requestEnd(kind: string | null = null) {
    if (!session || session.completed) return;
    setSession(interruptedSession(session));
    setPendingKind(kind);
    setConfirmEnd(true);
  }
  function endCurrent() {
    if (!session || session.completed) return;
    const result = endUnfinishedSession(() => localStorage, session.id);
    if (!result.ok) { setConfirmEnd(false); setPendingKind(null); setError(result.error); return; }
    const nextKind = pendingKind;
    lastSession.current = null;
    latest.current = null;
    setSession(null);
    setSelectedStrategies([]);
    setDescription("");
    setAid("没有");
    setFallback(false);
    setError("");
    setConfirmEnd(false);
    setPendingKind(null);
    if (nextKind) launch(nextKind);
    else setPage("home");
  }
  function launch(kind: string) {
    const questionCount = normalizeQuestionCount(kind);
    setQuestionCounts((current) => ({
      ...current,
      [kind]: String(questionCount),
    }));
    setError("");
    setSession(
      makeSession(
        kind,
        mode,
        mode === "test"
          ? 20261014
          : crypto.getRandomValues(new Uint32Array(1))[0],
        difficulty,
        questionCount,
      ),
    );
    setPage("run");
    setFallback(false);
  }

  function questionCountValue(kind: string, raw = questionCounts[kind]) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return defaultCounts[kind];
    return Math.min(maximumCount(kind), Math.max(1, Math.round(parsed)));
  }

  function normalizeQuestionCount(kind: string) {
    return questionCountValue(kind);
  }

  function commitQuestionCount(kind: string) {
    setQuestionCounts((current) => ({
      ...current,
      [kind]: String(questionCountValue(kind, current[kind])),
    }));
  }

  function stepQuestionCount(kind: string, direction: -1 | 1) {
    setQuestionCounts((current) => ({
      ...current,
      [kind]: String(
        questionCountValue(kind, current[kind]) + direction < 1
          ? 1
          : Math.min(
              maximumCount(kind),
              questionCountValue(kind, current[kind]) + direction,
            ),
      ),
    }));
  }
  function begin() {
    if (!session) return;
    setSelectedStrategies([]);
    setDescription("");
    setAid("没有");
    setSession({ ...session, phase: task?.hide ? "observe" : "answer" });
  }
  function answer(id: string) {
    if (!session || session.phase !== "answer") return;
    submitStrategy({...session,current:{...session.current,selectedId:id,
      stimulusSize:Math.round(document.querySelector(".choice .visual")?.getBoundingClientRect().width||0),
      responseMs:Math.round(performance.now()-answerStart.current)}});
  }
  function submitStrategy(s: Session = session!) {
    if(!s) return;
    const activeTask=s.tasks[s.index];
    const row={taskId:activeTask.id,selectedId:s.current.selectedId,
      correct:s.current.selectedId===activeTask.correctId,responseMs:s.current.responseMs,
      exposureMs:s.current.exposureMs,strategies:selectedStrategies,description,
      interrupted:s.current.interrupted,repeatedExposure:s.current.repeatedExposure,usedAid:aid,
      display:{width:innerWidth,height:innerHeight,stimulusSize:s.current.stimulusSize||0},completedAt:new Date().toISOString(),runnerVersion:"runner-v2-inline-optional",strategyTiming:"during-observation-or-answer"};
    const next={...s,rows:[...s.rows,row]};
    if(s.mode === "practice") setSession({...next,phase:"feedback"});
    else advance(next);
  }
  function advance(s: Session) {
    setSelectedStrategies([]);
    setDescription("");
    if (s.index === s.tasks.length - 1) setSession({ ...s, phase: "finish" });
    else {
      setAid("没有");
      setSession({
        ...s,
        index: s.index + 1,
        phase: s.tasks[s.index + 1].hide ? "observe" : "answer",
        current: emptyCurrent(),
        draft: undefined,
      });
    }
  }
  function finish() {
    if (!session) return;
    const done = {
      ...session,
      draft: undefined,
      completed: true,
      phase: "results",
      aid,
    };
    const updated = [done, ...history.filter((s) => s.id !== done.id)].slice(
      0,
      20,
    );
    setSession(done);
    setHistory(updated);
    const warning = saveHistory(() => localStorage, updated, loaded.historyReadable);
    if (warning) setError(warning);
  }
  function download(type: "json" | "csv") {
    if (!session) return;
    const content =
      type === "json"
        ? JSON.stringify(
            {
              ...session,
              unicodeManifest: session.kind === "unicode" ? unicode : undefined,
            },
            null,
            2,
          )
        : csv(session);
    try {
      const blob = new Blob([content], {
          type:
            type === "json"
              ? "application/json;charset=utf-8"
              : "text/csv;charset=utf-8",
        }),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `形迹-${session.id}.${type}`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch {
      setError("下载受限，请使用下方文本保存结果。");
    }
    setFallback(true);
  }
  function clear() {
    let result;
    try { result = clearRecords(localStorage); }
    catch { result = { ok: false, error: "浏览器存储不可访问，未执行清除。当前页面记录仍保留，请导出或复制。" }; }
    if (!result.ok) { setError(result.error); setConfirmClear(false); return; }
    lastSession.current = null;
    setSession(null);
    setHistory([]);
    setConfirmClear(false);
    setPage("home");
    setError("");
  }
  function Hero() {
    return (
      <div className="hero">
        <div>
          <p className="eyebrow">COGNITION LAB / 认知实验室</p>
          <h1>
            一个图形，
            <br />
            你会怎样记住？
          </h1>
          <p className="hero-copy">
            记住外观，寻找结构，或在脑海中重新排列。
            <br />
            用几分钟，观察自己思考的方式。
          </p>
          <div className="hero-tags">
            <span>独立探索</span>
            <span>匿名记录</span>
            <span>本地保存</span>
          </div>
        </div>
        <div className="hero-art">
          <div className="orbit" />
          <div className="art-shape a">
            <Visual value={{ shape: generate("polygon", 123).target }} />
          </div>
          <div className="art-shape b">
            <Visual value={{ shape: generate("smooth", 123).target }} />
          </div>
          <div className="art-shape c">
            <Visual value={{ shape: generate("mixed", 123).target }} />
          </div>
          <span className="art-caption">看见 · 记住 · 重新认识</span>
        </div>
      </div>
    );
  }
  const card = (kind: string, _num: string, desc: string, icon: string) => {
    const count = questionCountValue(kind);
    const max = maximumCount(kind);
    return (
      <article className="task-card" key={kind}>
        <div className="card-top">
          <span className="card-icon">{icon}</span>
          <span className="task-meta">{count}题 · 约{Math.max(1, Math.ceil(count * .6))}分钟</span>
        </div>
        <h3>{kindLabels[kind]}</h3><p>{desc}</p>
        <div className="question-count">
          <div>
            <label htmlFor={`question-count-${kind}`}>本轮题数</label>
            <small>可输入 1—{max}</small>
          </div>
          <div className="number-stepper">
            <button
              type="button"
              aria-label={`减少${kindLabels[kind]}题数`}
              onClick={() => stepQuestionCount(kind, -1)}
              disabled={count <= 1}
            >−</button>
            <input
              id={`question-count-${kind}`}
              aria-label={`${kindLabels[kind]}题数`}
              type="number"
              inputMode="numeric"
              min="1"
              max={max}
              step="1"
              value={questionCounts[kind] ?? ""}
              onChange={(event) => setQuestionCounts((current) => ({
                ...current,
                [kind]: event.target.value,
              }))}
              onBlur={() => commitQuestionCount(kind)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitQuestionCount(kind);
                  event.currentTarget.blur();
                }
              }}
            />
            <button
              type="button"
              aria-label={`增加${kindLabels[kind]}题数`}
              onClick={() => stepQuestionCount(kind, 1)}
              disabled={count >= max}
            >+</button>
          </div>
        </div>
        <div className="card-bottom"><span>{kind === "unicode" ? "试用材料" : "探索练习"}</span><button className="text-button" onClick={()=>start(kind)} disabled={!fontReady}>开始体验 ↗</button></div>
      </article>
    );
  };
  return (
    <>
      <header>
        <button className="brand" onClick={() => setPage("home")}>
          <Mark />
          <span>
            形迹<span className="brand-sub">认知实验室</span>
          </span>
        </button>
        <nav>
          <button
            className={page === "home" ? "active" : ""}
            onClick={() => setPage("home")}
          >
            探索
          </button>
          <button
            className={page === "records" ? "active" : ""}
            onClick={() => setPage("records")}
          >
            我的记录{history.length > 0 && <i>{history.length}</i>}
          </button>
          <button className="about-link" onClick={() => setPage("about")}>
            关于
          </button>
        </nav>
      </header>
      <main>
        {error && (
          <div className="notice warning" role="alert">
            {error}
            <button onClick={() => setError("")}>关闭</button>
          </div>
        )}
        {page === "home" && (
          <>
            <Hero />
            <div className="sample-entry">
              <div><strong>操作样例 · 不计分</strong><p>第一次使用？可在这里熟悉观察与选择。各实验入口直接开始正式题。</p></div>
              <button className="secondary" disabled={!fontReady} onClick={() => setPage("sample")}>查看样例 →</button>
            </div>
            {session && !session.completed && (
              <div className="resume">
                <div>
                  <strong>有一轮探索还未完成</strong>
                  <p>
                    {session.label} · 已完成 {session.rows.length}/
                    {session.tasks.length} 题
                  </p>
                </div>
                <div className="resume-actions"><button className="primary" onClick={() => setPage("run")}>
                  继续这轮 →
                </button><button className="text-button" onClick={() => requestEnd()}>结束本轮</button></div>
              </div>
            )}
            <div className="section-bar">
              <div className="tabs">
                <button
                  className={section === "intro" ? "active" : ""}
                  onClick={() => setSection("intro")}
                >
                  01 入门认知练习
                </button>
                <button
                  className={section === "shapes" ? "active" : ""}
                  onClick={() => setSection("shapes")}
                >
                  02 图形再认实验
                </button>
              </div>
              <div className="mode" aria-label="反馈模式">
                <button
                  className={mode === "practice" ? "active" : ""}
                  onClick={() => setMode("practice")}
                >
                  练习
                </button>
                <button
                  className={mode === "test" ? "active" : ""}
                  onClick={() => setMode("test")}
                >
                  测试
                </button>
              </div>
            </div>
            {section === "shapes" && <div className="difficulty-picker">
              <div className="difficulty-control">
                <label htmlFor="shape-difficulty">图形难度 <output htmlFor="shape-difficulty">{difficulty}%</output></label>
                <input id="shape-difficulty" aria-label="图形难度" aria-valuetext={`${difficulty}%`} style={{background:`linear-gradient(to right, #3f796a ${difficulty}%, #d4dfd7 ${difficulty}%)`}} type="range" min="0" max="100" step="1" value={difficulty} onChange={e=>setDifficulty(Number(e.target.value))} />
                <div className="difficulty-endpoints"><span>0% · 差异明显</span><span>100% · 差异细微</span></div>
              </div>
              <p>拖动设置难度，百分比越高，选项越相似。观察时间仍为10秒；开始后本轮难度固定。0%也需要认真观察。</p>
            </div>}
            <div className="section-intro">
              <h2>
                {section === "intro" ? "从熟悉的符号开始" : "让轮廓留在脑海里"}
              </h2>
              <p>
                {section === "intro"
                  ? "从顺序记忆到关系操作，体验不同的表征任务。"
                  : "三个图形家族，四个相似选项。留意你记住了哪些细节。"}
                <span>
                  {mode === "practice"
                    ? " · 作答后反馈"
                    : " · 整轮完成后反馈"}
                </span>
              </p>
            </div>
            <div className="cards">
              {section === "intro" ? (
                <>
                  {card(
                    "quick",
                    "3题 · 3–5分钟",
                    "符号、数字与配对信息，快速体验三种记忆材料。",
                    "◌",
                  )}
                  {card(
                    "twelve",
                    "12题 · 8–12分钟",
                    "记忆、变换、关系迁移、可逆性，循序探索四类任务。",
                    "↔",
                  )}
                  {card(
                    "unicode",
                    "6题 · 4–6分钟",
                    "遇见不常见的字符，观察熟悉程度如何影响记忆。",
                    "⟐",
                  )}
                </>
              ) : (
                <>
                  {card(
                    "mixed",
                    "9题 · 5–8分钟",
                    "均衡体验凹多边形、圆滑轮廓与直曲混合图形。",
                    "⌁",
                  )}
                  {card(
                    "polygon",
                    "6题 · 4–6分钟",
                    "留意顶点、凹口、边长与夹角之间的细微变化。",
                    "◇",
                  )}
                  {card(
                    "smooth",
                    "6题 · 4–6分钟",
                    "从圆滑波瓣与局部凸起中，找回刚才的轮廓。",
                    "∿",
                  )}
                  {card(
                    "curve",
                    "6题 · 4–6分钟",
                    "直线连接曲线，观察拐角与弧段的局部关系。",
                    "◠",
                  )}
                </>
              )}
            </div>
            <div className="method-strip">
              <div>
                <span>01</span>
                <strong>观察材料</strong>
                <p>记忆题呈现10秒</p>
              </div>
              <div>
                <span>02</span>
                <strong>独立作答</strong>
                <p>从四个选项中选择</p>
              </div>
              <div>
                <span>03</span>
                <strong>选填记忆方式</strong>
                <p>回看自己的思考过程</p>
              </div>
            </div>
            <div className="bottom-note">
              <p>
                这些任务用于探索本轮表现，不提供认知能力评级。答案只保存在本浏览器。
              </p>
              <button className="text-button" onClick={() => setPage("about")}>
                了解实验与数据 →
              </button>
            </div>
          </>
        )}
        {page === "sample" && <div className="runner"><div className="run-top"><button className="text-button" onClick={() => setPage("home")}>← 返回首页</button><span>独立样例 · 不计分</span></div><Sample onDone={() => setPage("home")} /></div>}
        {page === "run" && session && task && (
          <div className="runner">
            <div className="run-top">
              <button className="text-button" onClick={() => setPage("home")}>
                ← 返回首页
              </button>
              <span>
                {session.label} ·{" "}
                {session.mode === "practice" ? "练习" : "测试"}
                {session.difficulty !== undefined ? ` · ${difficultyLabel(session.difficulty)}` : session.tasks.some(t=>t.stimulus) ? " · 困难（旧版）" : ""}
              </span>
              {!session.completed && <button className="text-button" onClick={() => requestEnd()}>结束本轮</button>}
            </div>
            {!["intro", "results"].includes(session.phase) && (
              <div className="progress-row">
                <span>{task.group}</span>
                <span>
                  {session.rows.length} / {session.tasks.length} 已完成
                </span>
                <progress
                  max={session.tasks.length}
                  value={session.rows.length}
                />
              </div>
            )}
            {session.phase === "intro" && (
              <>
                <p className="eyebrow">开始之前</p>
                <h1 tabIndex={-1}>{session.label}</h1>
                <p className="muted">本轮共 {session.tasks.length} 题</p>
                {session.difficulty !== undefined && <p className="muted">当前难度：{difficultyLabel(session.difficulty)} · 记忆方式选填</p>}
                {session.difficulty === undefined && session.tasks.some(t=>t.stimulus) && <p className="muted">这轮保留旧版细微差异材料。要调整难度，请结束本轮后重新选择百分比。</p>}
                <p className="lead">按你自然的方式思考，答错也没有关系。</p>
                <div className="instruction">
                  <h3>这轮如何进行</h3>
                  <ol>
                    <li>同意参与后直接开始本轮正式题；操作样例可从首页独立进入。</li>
                    <li>记忆材料会自动隐藏；操作题会保留题面。</li>
                    <li>记忆材料下方可选填记忆方式；空着也能正常作答。</li>
                    <li>
                      {session.mode === "practice"
                        ? "选择答案后可查看本题反馈。"
                        : "全部完成后才会显示答案。"}
                    </li>
                  </ol>
                  <p>
                    请独立完成，不截图、不做笔记、不回看原图。若使用辅助方式，请如实记录。可随时退出，进度保存在当前浏览器。
                  </p>
                  <p>
                    不收集姓名或账号，也不会自动上传答案。本任务属于非标准化探索练习，不用于医学诊断或智力评级。
                  </p>
                </div>
                <div className="actions">
                  <button
                    className="primary"
                    disabled={!fontReady}
                    onClick={begin}
                  >
                    我同意参与，开始正式实验 →
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      setSession(null);
                      setPage("home");
                    }}
                  >
                    不同意，返回首页
                  </button>
                </div>
              </>
            )}
            {session.phase === "observe" && (
              <>
                <p className="eyebrow">观察阶段</p>
                <h1 tabIndex={-1}>{task.title}</h1>
                <p className="muted">尽量记住材料，按你自然的方式记忆。</p>
                <div className="stimulus" ref={materialRef}>
                  <Visual value={task.material} />
                </div>
                <div className="countdown">
                  <span className="count">
                    {seconds.toString().padStart(2, "0")}
                  </span>
                  <span>秒后，材料将自动隐藏</span>
                </div>
              </>
            )}
            {session.phase === "answer" && (
              <>
                <p className="eyebrow">选择阶段</p>
                <h1 tabIndex={-1}>{task.prompt}</h1>
                {!task.hide ? (
                  <div className="reference" ref={materialRef}>
                    <span>题目材料</span>
                    <Visual value={task.material} />
                  </div>
                ) : (
                  <p className="muted">原材料已隐藏，请选择一个答案。</p>
                )}
                <div className="choices">
                  {task.options.map((o, i) => (
                    <button
                      className="choice"
                      key={o.id}
                      onClick={() => answer(o.id)}
                      aria-label={`选项 ${"ABCD"[i]}`}
                    >
                      <span className="letter">{"ABCD"[i]}</span>
                      <Visual value={o.display} small />
                    </button>
                  ))}
                </div>
                <p className="hint">记忆方式选填；选择答案后直接继续。本题答案会锁定。</p>
              </>
            )}
            {["observe","answer","strategy"].includes(session.phase) && <StrategyFields
              selectedStrategies={selectedStrategies} setSelectedStrategies={setSelectedStrategies}
              description={description} setDescription={setDescription} aid={aid} setAid={setAid}/>}
            {session.phase === "strategy" && <><p className="notice">记忆方式现在为选填，可直接继续。</p><button className="primary" onClick={()=>submitStrategy()}>保存答案，继续 →</button></>}
            {session.phase === "feedback" && (
              <>
                <p className="eyebrow">本题反馈</p>
                <h1 tabIndex={-1} className={session.rows.at(-1)?.correct ? "answer-correct" : "answer-incorrect"}>
                  {session.rows.at(-1)?.correct ? "✓ 回答正确" : "✕ 回答错误"}
                </h1>
                <p role="status">{session.rows.at(-1)?.correct ? "你选对了，所选选项与正确答案一致。" : "你没有选对，可以对照下方正确答案再看一次。"}</p>
                <div className="feedback-options">
                  <div>
                    <p>你的选择 · {session.rows.at(-1)?.correct ? "正确" : "错误"}</p>
                    <Visual
                      value={
                        task.options.find(
                          (o) => o.id === session.current.selectedId,
                        )!.display
                      }
                    />
                  </div>
                  <div>
                    <p>正确答案</p>
                    <Visual
                      value={
                        task.options.find((o) => o.id === task.correctId)!
                          .display
                      }
                    />
                  </div>
                </div>
                <p className="explanation">{task.explanation}</p>
                {session.current.interrupted && (
                  <p className="notice">本题发生中断或重复暴露，将单独标记。</p>
                )}
                <button className="primary" onClick={() => advance(session)}>
                  {session.index === session.tasks.length - 1
                    ? "完成这轮"
                    : "下一题"}{" "}
                  →
                </button>
              </>
            )}
            {session.phase === "interrupted" && (
              <>
                <p className="eyebrow">轮次已暂停</p>
                <h1 tabIndex={-1}>这一题发生了中断</h1>
                <p className="lead">
                  切换页面或刷新可能改变观察时间。恢复后重新呈现同一材料，保留中断与重复暴露记录。
                </p>
                <p className="muted">
                  本题仍可完成，但不计入正常试次的平均作答时间。
                </p>
                <button
                  className="primary"
                  onClick={() => {
                    setSession(retrySession(session));
                  }}
                >
                  重新开始本题 →
                </button>
              </>
            )}
            {session.phase === "finish" && (
              <>
                <p className="eyebrow">最后一点记录</p>
                <h1 tabIndex={-1}>这一轮，你有什么发现？</h1>
                <label className="field">
                  整轮是否使用过辅助方式？
                  <select
                    value={aid}
                    onChange={(e) => {
                      setAid(e.target.value);
                      if (session.phase === "finish")
                        setSession({ ...session, aid: e.target.value });
                    }}
                  >
                    <option>没有</option>
                    <option>有</option>
                    <option>不确定</option>
                  </select>
                </label>
                {session.kind === "unicode" && (
                  <>
                    <p className="muted">
                      请记录本轮见过的字符对你的熟悉程度；任务中不会预先提示。
                    </p>
                    <div className="familiarity">
                      {unicode
                        .filter((u) =>
                          session.tasks.some((t) =>
                            t.unicodeIds?.includes(u.symbol_id),
                          ),
                        )
                        .map((u) => (
                          <label key={u.symbol_id}>
                            <span style={{ fontFamily: u.font }}>{u.char}</span>
                            <select
                              aria-label={`${u.char} 的熟悉程度`}
                              value={session.familiarity[u.symbol_id] || ""}
                              onChange={(e) =>
                                setSession({
                                  ...session,
                                  familiarity: {
                                    ...session.familiarity,
                                    [u.symbol_id]: e.target.value,
                                  },
                                })
                              }
                            >
                              <option value="">请选择</option>
                              <option>熟悉</option>
                              <option>见过但不熟悉</option>
                              <option>首次见到</option>
                            </select>
                          </label>
                        ))}
                    </div>
                  </>
                )}
                <label className="field">
                  想法与反馈 <span>可选</span>
                  <textarea
                    value={session.feedback}
                    maxLength={2000}
                    onChange={(e) =>
                      setSession({ ...session, feedback: e.target.value })
                    }
                    placeholder="哪些材料容易记住？哪些地方让你犹豫？"
                  />
                </label>
                <button
                  className="primary"
                  disabled={
                    session.kind === "unicode" &&
                    unicode.some(
                      (u) =>
                        session.tasks.some((t) =>
                          t.unicodeIds?.includes(u.symbol_id),
                        ) && !session.familiarity[u.symbol_id],
                    )
                  }
                  onClick={finish}
                >
                  查看本轮结果 →
                </button>
              </>
            )}
            {session.phase === "results" && (
              <>
                <p className="eyebrow">本轮探索完成</p>
                <h1 tabIndex={-1}>留下答案，也留下思考的方式。</h1>
                <p className="muted">
                  {session.label} ·{" "}
                  {new Date(session.createdAt).toLocaleDateString("zh-CN")} ·{" "}
                  {session.mode === "practice" ? "练习" : "测试"}
                  {session.difficulty !== undefined ? ` · ${difficultyLabel(session.difficulty)}` : session.tasks.some(t=>t.stimulus) ? " · 困难（旧版）" : ""}
                </p>
                <div className="result-groups">
                  {groups(session).map((g) => (
                    <div className="result-group" key={g.group}>
                      <p>{g.group}</p>
                      <strong>
                        {g.correct}
                        <small> / {g.count}</small>
                      </strong>
                      <span>
                        正常试次 {g.normal} 题 ·{" "}
                        {g.meanMs === null
                          ? "无可用计时"
                          : `${(g.meanMs / 1000).toFixed(1)}秒平均作答`}
                      </span>
                    </div>
                  ))}
                </div>
                <h2>你记录的记忆方式</h2>{!session.rows.some(r=>r.strategies.length>0||r.description.trim())&&<p className="muted">本轮未填写记忆方式。</p>}
                <div className="strategy-bars">
                  {strategies.map(([id, label]) => {
                    const count = session.rows.filter((r) =>
                      r.strategies.includes(id),
                    ).length;
                    return count ? (
                      <div key={id}>
                        <span>{label}</span>
                        <div>
                          <i
                            style={{
                              width: `${(count / session.rows.length) * 100}%`,
                            }}
                          />
                        </div>
                        <b>{count}题</b>
                      </div>
                    ) : null;
                  })}
                </div>
                <h2>逐题回看</h2>
                <div className="review-list">
                  {session.rows.map((r, i) => {
                    const t = session.tasks.find((t) => t.id === r.taskId)!;
                    return (
                      <details key={r.taskId}>
                        <summary>
                          <span>
                            {String(i + 1).padStart(2, "0")} · {t.group}
                          </span>
                          <span>
                            {r.correct ? "正确" : "不同"} ·{" "}
                            {(r.responseMs / 1000).toFixed(1)}秒{" "}
                            {!normalRow(r) ? "· 条件标记" : ""}
                          </span>
                        </summary>
                        <p>{t.prompt}</p>
                        <div className="feedback-options">
                          <div>
                            <p>你的选择</p>
                            <Visual
                              value={
                                t.options.find((o) => o.id === r.selectedId)!
                                  .display
                              }
                            />
                          </div>
                          <div>
                            <p>正确答案</p>
                            <Visual
                              value={
                                t.options.find((o) => o.id === t.correctId)!
                                  .display
                              }
                            />
                          </div>
                        </div>
                        <p>{t.explanation}</p>
                        <p>
                          策略：
                          {r.strategies
                            .map(
                              (id) => strategies.find((x) => x[0] === id)?.[1],
                            )
                            .join("、") || "未填写"}
                        </p>
                        {r.description && <p>记录：{r.description}</p>}
                        <p className="muted">
                          中断：{r.interrupted ? "是" : "否"} · 重复暴露：
                          {r.repeatedExposure}次 · 辅助：{r.usedAid}
                        </p>
                      </details>
                    );
                  })}
                </div>
                <div className="actions">
                  <button className="primary" onClick={() => download("json")}>
                    下载完整 JSON ↓
                  </button>
                  <button className="secondary" onClick={() => download("csv")}>
                    下载逐题 CSV ↓
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setFallback((v) => !v)}
                  >
                    显示可复制文本
                  </button>
                </div>
                {fallback && (
                  <label className="field">
                    若浏览器无法下载，可全选并复制以下结果
                    <textarea
                      readOnly
                      value={JSON.stringify(
                        {
                          ...session,
                          unicodeManifest:
                            session.kind === "unicode" ? unicode : undefined,
                        },
                        null,
                        2,
                      )}
                    />
                  </label>
                )}
                <p className="notice">
                  这些结果只描述本轮表现。
                  {session.aid !== "没有"
                    ? "本轮报告使用或可能使用辅助方式，解释结果时需保留此条件。"
                    : "重复练习同一批材料会受到熟悉度影响。"}
                </p>
                <button className="secondary" onClick={() => setPage("home")}>
                  返回探索首页
                </button>
              </>
            )}
          </div>
        )}
        {page === "records" && (
          <div className="runner">
            <p className="eyebrow">保存在本浏览器</p>
            <h1>我的探索记录</h1>
            <p className="muted">
              最多保留最近20轮完成记录。切换浏览器或清除数据后不可恢复，请下载重要结果。
            </p>
            {history.length ? (
              history.map((s) => (
                <button
                  className="record"
                  key={s.id}
                  onClick={() => {
                    if (session && !session.completed) {
                      setError("请先完成或清除当前轮次，再查看历史结果。");
                      return;
                    }
                    setSession(s);
                    setPage("run");
                  }}
                >
                  <strong>{s.label}</strong>
                  <span>{new Date(s.createdAt).toLocaleString("zh-CN")} →</span>
                </button>
              ))
            ) : (
              <div className="empty">
                <Mark />
                <h2>还没有完成的记录</h2>
                <p>从一次小小的探索开始。</p>
                <button className="primary" onClick={() => setPage("home")}>
                  选择练习 →
                </button>
              </div>
            )}
          </div>
        )}
        {page === "about" && (
          <div className="runner">
            <p className="eyebrow">关于这份探索</p>
            <h1>观察表现，理解过程。</h1>
            <p className="lead">
              形迹是一组非标准化认知任务，关注视觉记忆、关系操作与参与者实际采用的策略。
            </p>
            <div className="instruction">
              <h2>材料与版本</h2>
              <p>
                三题沿用已有问卷材料，策略记录更新为多选（v1.1）。十二题重新设计（operations-new-v1.0），保留记忆、变换、迁移、可逆性四类形式。图形通过0%—100%滑动条连续调节难度，记忆方式可在观察时选填。图形由代码生成：shape-v1.2.0
                / mulberry32-v1。
              </p>
              <p>
                Unicode 试用池含30个字符，来自本地Unicode
                17精选与全码表，字形由本地 Noto 字体呈现。字体许可证随源码保存。
              </p>
              <h2>你的数据</h2>
              <p>
                答案与进度只保存在当前浏览器，不自动上传，不要求登录。不收集真实姓名、微信号或账号。JSON包含本轮题目、图形参数、种子、策略与显示信息；CSV按题导出。
              </p>
              <h2>如何理解结果</h2>
              <p>
                不同家族和任务的难度不可直接等同。计时是浏览器近似记录，中断、重复暴露和辅助情况需要单独考虑。本网站不推断智商、诊断或认知发展阶段。
              </p>
              <h2>原型验收边界</h2>
              <p>
                本地原型可用于预测试；真实手机、微信浏览器及朋友所在网络仍需通过实际访问验证。
              </p>
            </div>
          </div>
        )}
      </main>
      <footer>
        <span>形迹 / 让思考的过程可见</span>
        <div>
          <span>本地原型 v0.1</span>
          <button onClick={() => setConfirmClear(true)}>清除本地记录</button>
        </div>
      </footer>
      {confirmEnd && session && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="end-title">
            <h2 id="end-title">{pendingKind ? "结束当前实验并切换？" : "结束本轮实验？"}</h2>
            <p>“{session.label}”已完成 {session.rows.length}/{session.tasks.length} 题。结束后将丢弃本轮未完成进度，不能继续本轮。已完成的历史记录会保留。</p>
            {pendingKind && <p>接下来开始：{kindLabels[pendingKind]}。</p>}
            {session.rows.length > 0 && <button className="text-button" onClick={() => download("json")}>先导出已答内容 JSON ↓</button>}
            {fallback && session.rows.length > 0 && <label className="field">无法下载时，可复制已答内容<textarea readOnly value={JSON.stringify({...session,unicodeManifest:session.kind === "unicode" ? unicode : undefined},null,2)}/></label>}
            <div className="actions">
              <button className="secondary" autoFocus onClick={() => { setConfirmEnd(false); setPendingKind(null); }}>暂不结束</button>
              <button className="primary" onClick={endCurrent}>{pendingKind ? "结束并开始新实验" : "结束并返回首页"}</button>
            </div>
          </div>
        </div>
      )}
      {confirmClear && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-title"
          >
            <h2 id="clear-title">清除本浏览器的记录？</h2>
            <p>将移除当前进度与全部历史轮次。已下载的文件不受影响。</p>
            <div className="actions">
              <button
                className="secondary"
                autoFocus
                onClick={() => setConfirmClear(false)}
              >
                取消
              </button>
              <button className="primary" onClick={clear}>
                确认清除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
