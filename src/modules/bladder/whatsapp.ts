import { addDays, zonedIso } from "@/lib/dates";

/**
 * Turns a leak log kept in a WhatsApp chat into bladder-diary entries.
 * Understands the usual export/copy formats, typos ("lesk"), counts
 * ("Leak 2 times"), times written in the text ("Leak at 6:10"), night
 * leaks, triggers (cough, sneeze, laugh, yoga, in the washroom) and skips
 * lines that aren't leaks (discharge only, "vomit", chatter).
 */

export type LeakAmount = "drops" | "small" | "large";
export type LeakTrigger = "cough" | "sneeze" | "laugh" | "yoga" | "urgency" | "during_sleep" | "other";
export type ParsedLeak = {
  at: string;
  date: string;
  time: string;
  amount: LeakAmount;
  triggers: LeakTrigger[];
  notes: string;
  text: string;
  sender: string;
};
export type SkippedLine = { line: string; reason: string };

type Message = { date: string; time: string; sender: string; text: string };

const IOS = /^\[(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?,\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])?\.?\s*m?\.?\]\s*([^:]{1,60}):\s?(.*)$/i;
const ANDROID = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s*(\d{1,2}):(\d{2})\s*([ap])?\.?\s*m?\.?\s*[-–]\s*([^:]{1,60}):\s?(.*)$/i;

const pad = (n: number) => String(n).padStart(2, "0");
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMin = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

function resolveYear(day: number, month: number, raw: string | undefined, opts: { year?: number; today: string }) {
  if (raw) return raw.length === 2 ? 2000 + Number(raw) : Number(raw);
  const base = opts.year ?? Number(opts.today.slice(0, 4));
  const candidate = `${base}-${pad(month)}-${pad(day)}`;
  // Without a year, a date after today belongs to last year.
  return !opts.year && candidate > opts.today ? base - 1 : base;
}

/** Splits the chat into messages; continuation lines become their own messages with the same header. */
export function splitMessages(chat: string, opts: { year?: number; today: string }): { messages: Message[]; skipped: SkippedLine[] } {
  const messages: Message[] = [];
  const skipped: SkippedLine[] = [];
  let last: Omit<Message, "text"> | null = null;
  for (const raw of chat.replace(/‎| /g, " ").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(IOS) ?? line.match(ANDROID);
    if (m) {
      const [, d, mo, y, h, mi, ap, sender, text] = m;
      let hour = Number(h);
      if (ap) hour = (hour % 12) + (ap.toLowerCase() === "p" ? 12 : 0);
      const year = resolveYear(Number(d), Number(mo), y, opts);
      last = { date: `${year}-${pad(Number(mo))}-${pad(Number(d))}`, time: `${pad(hour)}:${mi}`, sender: sender.replace(/[^\p{L}\p{N} .'-]/gu, "").trim() };
      messages.push({ ...last, text });
    } else if (last) {
      messages.push({ ...last, text: line });
    } else {
      skipped.push({ line, reason: "Not a chat message line" });
    }
  }
  return { messages, skipped };
}

const LEAK_WORDS = new Set(["leak", "leaks", "leaked", "leaking", "leakage", "lesk", "kesk", "lek", "leek", "leake", "laek", "lak"]);
const NOT_LEAK = new Set(["weak", "peak", "beak", "lead", "lean", "leap", "lear", "lake", "lack", "leg", "lie"]);
function lev(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
const isLeakWord = (w: string) => LEAK_WORDS.has(w) || (!NOT_LEAK.has(w) && w.length >= 3 && w.length <= 6 && w.startsWith("l") && lev(w, "leak") <= 1);

/** Clock time written in the text, resolved against the message time ("Leak at 5" sent 18:17 → 17:00). */
function explicitTime(text: string, msgTime: string): { time: string; dayOffset: number } | "unclear" | null {
  const t = text.toLowerCase();
  let h: number | null = null;
  let m = 0;
  let ap: string | null = null;
  const hm = t.match(/(\d{1,2})[:.](\d{2})\s*(am|pm)?/);
  const at = t.match(/\bat\s+(\d{1,2})(?:\s*(am|pm))?\b(?!\s*(?:times?|x)\b)/);
  const bare = t.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (hm) [h, m, ap] = [Number(hm[1]), Number(hm[2]), hm[3] ?? null];
  else if (at) [h, ap] = [Number(at[1]), at[2] ?? null];
  else if (bare) [h, ap] = [Number(bare[1]), bare[2]];
  else if (/\d{1,2}:\d\b/.test(t)) return "unclear";
  if (h === null || h > 23 || m > 59) return null;
  const msg = toMin(msgTime);
  if (ap || h > 12) {
    const hh = ap ? (h % 12) + (ap === "pm" ? 12 : 0) : h;
    const v = hh * 60 + m;
    return v <= msg ? { time: fromMin(v), dayOffset: 0 } : { time: fromMin(v), dayOffset: -1 };
  }
  const options = [(h % 12) * 60 + m, ((h % 12) + 12) * 60 + m].filter((v) => v <= msg);
  if (options.length) return { time: fromMin(Math.max(...options)), dayOffset: 0 };
  return { time: fromMin(((h % 12) + 12) * 60 + m), dayOffset: -1 };
}

export function parseWhatsAppLeaks(chat: string, opts: { today: string; tz: string; year?: number; ownerName?: string }): { rows: ParsedLeak[]; skipped: SkippedLine[] } {
  const { messages, skipped } = splitMessages(chat, opts);
  const rows: ParsedLeak[] = [];
  const owner = (opts.ownerName ?? "").toLowerCase().trim();

  for (const msg of messages) {
    const raw = msg.text.trim();
    const text = raw.toLowerCase();
    const words = text.match(/[a-z]+/g) ?? [];
    const hasLeak = words.some(isLeakWord) || /\d+\s*drops?\b/.test(text);
    const discharge = /discharg/.test(text);
    const line = `${msg.date} ${msg.time} ${msg.sender}: ${raw}`;
    if (/\bno\s+(leak|lesk|lek)/.test(text) || !hasLeak) {
      skipped.push({
        line,
        reason: discharge ? "Discharge, not a leak" : /vomit|throw(ing)? up|nausea/.test(text) ? "Health note: add it as an event" : /\bno\s+leak/.test(text) ? "Says no leak" : "No leak mentioned",
      });
      continue;
    }

    const notes: string[] = [];
    const amount: LeakAmount = /\b(a\s*lot|alot|lot of|lots|continuous|heavy|huge)\b/.test(text)
      ? "large"
      : /\b(less+|les|lil|little|slight|bit)\b|\d+\s*drops?\b/.test(text) || words.some((w) => /^les+$/.test(w))
        ? "drops"
        : "small";

    const triggers = new Set<LeakTrigger>();
    if (/cough/.test(text)) triggers.add("cough");
    if (/sneez/.test(text)) triggers.add("sneeze");
    if (/laugh/.test(text)) triggers.add("laugh");
    if (/yoga/.test(text)) triggers.add("yoga");
    if (/washroom|toilet|bathroom|loo\b/.test(text)) triggers.add("urgency");
    if (/\bgas\b|fart/.test(text)) triggers.add("other");
    if (/urinat|peeing/.test(text)) triggers.add("other");
    if (discharge) notes.push("with discharge");

    let count = 1;
    // A number that is part of a clock time ("11:15 leak") is not a count.
    const c = text.match(/(?<![\d:.])(\d{1,2})\s*(?:times?|x)\b/) ?? text.match(/(?<![\d:.])\b(\d{1,2})\s+leaks?\b/);
    if (c) count = Math.min(10, Math.max(1, Number(c[1])));
    else if (words.filter(isLeakWord).length >= 2 && /\band\b/.test(text)) count = 2; // "Leak and leak in washroom"
    if (/(many|several|sereval|multiple|lots of)\s+times?/.test(text)) notes.push("several times (count not given)");

    const night = /\bnight\b/.test(text);
    const fromMorning = /from morning/.test(text);
    let date = msg.date;
    let base = toMin(msg.time);
    let spread = 1;
    const exp = explicitTime(raw, msg.time);
    if (exp === "unclear") notes.push("time unclear, used message time");
    else if (exp) {
      base = toMin(exp.time);
      if (exp.dayOffset) date = addDays(date, exp.dayOffset);
    } else if (night) {
      if (base < 12 * 60) base = 2 * 60;
    } else if (fromMorning && count > 1) {
      const start = 7 * 60;
      spread = Math.max(1, Math.floor((base - start) / count));
      base = start;
    }
    if (night) triggers.add("during_sleep");

    const sender = msg.sender.toLowerCase();
    const loggedBy = owner && !sender.startsWith(owner) ? ` (logged by ${msg.sender})` : "";
    const note = [`WhatsApp: "${raw.slice(0, 200)}"${loggedBy}`, ...notes].join("; ");
    for (let i = 0; i < count; i++) {
      const minute = Math.min(base + i * spread, 23 * 60 + 59);
      const time = fromMin(minute);
      rows.push({ at: zonedIso(date, time, opts.tz), date, time, amount, triggers: [...triggers], notes: note.slice(0, 1000), text: raw, sender: msg.sender });
    }
  }
  rows.sort((a, b) => a.at.localeCompare(b.at));
  // Two identical messages in the same minute are two leaks: nudge the later one so both survive the duplicate check.
  const seen = new Set<string>();
  for (const r of rows) {
    while (seen.has(leakKey(r))) {
      const next = toMin(r.time) + 1;
      if (next >= 24 * 60) break;
      r.time = fromMin(next);
      r.at = zonedIso(r.date, r.time, opts.tz);
    }
    seen.add(leakKey(r));
  }
  rows.sort((a, b) => a.at.localeCompare(b.at));
  return { rows, skipped };
}

/** Identity used to skip rows already imported (same moment and same original note). */
export const leakKey = (r: { at: string; notes: string | null }) => `${new Date(r.at).toISOString().slice(0, 16)}|${r.notes ?? ""}`;
