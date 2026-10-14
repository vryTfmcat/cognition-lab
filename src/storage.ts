import { emptyCurrent, type Session } from "./core";

export const KEY = "cognition-lab-session-v1";
export const HISTORY = "cognition-lab-history-v1";
export const SAVE_WARNING = "浏览器本地保存失败。本轮仍可作答，请在结束后下载结果或复制文本；关闭页面将无法恢复。";
export type RecordStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function endUnfinishedSession(access: () => RecordStorage, id: string): { ok: boolean; error: string } {
  try {
    const storage = access(), raw = storage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Session;
      if (saved.id !== id || saved.completed) return { ok: false, error: "当前记录已在其他页面发生变化，请刷新后再操作。未删除任何记录。" };
      storage.removeItem(KEY);
    }
    return { ok: true, error: "" };
  } catch {
    return { ok: false, error: "未能结束本轮，本地进度仍保留。请重试，或先导出已答内容。" };
  }
}

export function saveSession(access: () => RecordStorage, session: Session | null, readable: boolean, hadSession = false): string {
  if (!readable) return session ? SAVE_WARNING : "";
  try {
    if (session) access().setItem(KEY, JSON.stringify(session));
    else if (hadSession) access().removeItem(KEY);
    return "";
  } catch { return SAVE_WARNING; }
}
export function saveHistory(access: () => RecordStorage, history: Session[], readable: boolean): string {
  const warning = "历史记录保存失败，请下载本轮结果或复制文本；刷新前请保留当前页面。";
  if (!readable) return warning;
  try { access().setItem(HISTORY, JSON.stringify(history)); return ""; }
  catch { return warning; }
}

export function interruptedSession(s: Session): Session {
  if (!["observe", "answer"].includes(s.phase)) return s;
  return { ...s, phase: "interrupted", current: { ...s.current, interrupted: true } };
}
export function retrySession(s: Session): Session {
  return {
    ...s,
    phase: s.tasks[s.index].hide ? "observe" : "answer",
    current: { ...emptyCurrent(), interrupted: true, repeatedExposure: s.current.repeatedExposure + 1 },
  };
}
export function loadRecords(access: () => RecordStorage) {
  let session: Session | null = null;
  let history: Session[] = [];
  let sessionReadable = false;
  let historyReadable = false;
  const errors: string[] = [];
  try {
    const raw = access().getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Session;
      if (s.schemaVersion !== "1.0" || !Array.isArray(s.tasks) || !s.tasks.length || !s.current || !Array.isArray(s.rows)) throw new Error("Invalid session");
      // Earlier versions put every experiment through a shared sample.
      // Resume those saved rounds at their own introduction instead.
      session = interruptedSession(s.phase === "sample" ? { ...s, phase: "intro" } : s);
    }
    sessionReadable = true;
  } catch {
    errors.push("当前进度读取失败，未删除原记录。刷新前请先下载或复制本页可用结果。");
  }
  try {
    const parsed = JSON.parse(access().getItem(HISTORY) || "[]");
    if (!Array.isArray(parsed)) throw new Error("Invalid history");
    history = parsed;
    historyReadable = true;
  } catch {
    errors.push("历史记录读取失败，原记录未改动；本页完成的新轮次不会覆盖未知历史，请自行导出后再刷新重试。");
  }
  return { session, history, sessionReadable, historyReadable, error: errors.join(" ") };
}

// Take both backups before changing anything. A rejected read must not trigger deletion.
export function clearRecords(storage: RecordStorage): { ok: boolean; error: string } {
  let backup: [string, string | null][];
  try {
    backup = [KEY, HISTORY].map(key => [key, storage.getItem(key)]);
  } catch {
    return { ok: false, error: "无法读取清除前备份，未执行清除。当前页面记录仍可导出或复制。" };
  }
  const removed: [string, string | null][] = [];
  try {
    for (const entry of backup) {
      storage.removeItem(entry[0]);
      removed.push(entry);
    }
    return { ok: true, error: "" };
  } catch {
    let restored = true;
    for (const [key, value] of removed) {
      try {
        if (value !== null) storage.setItem(key, value);
      } catch { restored = false; }
    }
    return {
      ok: false,
      error: restored
        ? "清除失败，已恢复本次已移除的记录。当前页面记录仍保留，请导出或复制后再重试。"
        : "清除未完成，部分本地记录已移除且恢复失败。当前页面仍保留内存中的进度与历史，请先导出或复制，暂勿刷新。",
    };
  }
}
