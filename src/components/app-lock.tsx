"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { LogoMark } from "@/components/logo";

/**
 * Device-local app lock. Uses a platform passkey (fingerprint / face / device
 * PIN via WebAuthn with user verification) or a Hearth PIN as fallback.
 * Settings live in localStorage on this device only; the unlock state is per
 * browser tab session.
 *
 * It can lock the whole app, or only the private screens (private log,
 * cycle, medical records): the rest of the app opens as usual and those ask
 * first, again after the app has been away or you've been elsewhere in it.
 */
type LockConfig = { method: "passkey" | "pin"; credId?: string; pinHash?: string; salt?: string; timeoutMin: number; scope?: "app" | "sensitive"; sections?: string[] };

/** Screens the "private screens only" lock covers. */
export const LOCKABLE: { key: string; label: string; paths: string[] }[] = [
  { key: "private_log", label: "Private log", paths: ["/private"] },
  { key: "cycle", label: "Cycle", paths: ["/cycle"] },
  { key: "medical_records", label: "Medical records & labs", paths: ["/medical"] },
  { key: "bladder_diary", label: "Bladder diary", paths: ["/bladder"] },
];
const DEFAULT_SECTIONS = ["private_log", "cycle", "medical_records"];
const SENSITIVE_LEFT = "hearth.sensitiveLeftAt";
const UNLOCKED_SENSITIVE = "hearth.unlockedSensitiveAt";

const lockedPaths = (c: LockConfig) => LOCKABLE.filter((l) => (c.sections ?? DEFAULT_SECTIONS).includes(l.key)).flatMap((l) => l.paths);
const onPaths = (path: string, paths: string[]) => paths.some((p) => path === p || path.startsWith(`${p}/`));

const KEY = "hearth.lock";
const UNLOCKED = "hearth.unlockedAt";
const HIDDEN_AT = "hearth.hiddenAt";
const EVENT = "hearth-lock-change";

function parseConfig(raw: string | null): LockConfig | null {
  try {
    return raw ? (JSON.parse(raw) as LockConfig) : null;
  } catch {
    return null;
  }
}
function writeConfig(c: LockConfig | null) {
  try {
    if (c) localStorage.setItem(KEY, JSON.stringify(c));
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* storage unavailable */
  }
}
function markUnlocked(sensitive = false) {
  try {
    sessionStorage.setItem(sensitive ? UNLOCKED_SENSITIVE : UNLOCKED, String(Date.now()));
    if (sensitive) sessionStorage.removeItem(SENSITIVE_LEFT);
  } catch {
    /* ignore */
  }
}

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));

async function hashPin(pin: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unb64(salt), iterations: 210000 }, key, 256);
  return b64(bits);
}

async function verifyPasskey(credId: string) {
  await navigator.credentials.get({
    publicKey: { challenge: rand(32), allowCredentials: [{ type: "public-key", id: unb64(credId) }], userVerification: "required", timeout: 60000 },
  });
}

function useConfig() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      window.addEventListener("storage", cb);
      return () => {
        window.removeEventListener(EVENT, cb);
        window.removeEventListener("storage", cb);
      };
    },
    () => {
      try {
        return localStorage.getItem(KEY);
      } catch {
        return null;
      }
    },
    () => null,
  );
}

/** Full-screen lock shown over the app when needed. Mounted in the app layout. */
export function AppLockGate() {
  const raw = useConfig();
  const config = useMemo(() => parseConfig(raw), [raw]);
  const path = usePathname();
  const sensitive = config?.scope === "sensitive";
  const here = Boolean(config && (!sensitive || onPaths(path, lockedPaths(config))));
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const wasHere = useRef(false);
  // Which page the lock was last checked for: until then a covered screen, so a private page doesn't flash.
  const [checkedFor, setCheckedFor] = useState<string | null>(null);

  const evaluate = useCallback(() => {
    if (!config || !here) return setLocked(false);
    let unlockedAt = 0;
    let hiddenAt = 0;
    let leftAt = 0;
    try {
      unlockedAt = Number(sessionStorage.getItem(sensitive ? UNLOCKED_SENSITIVE : UNLOCKED) ?? 0);
      hiddenAt = Number(sessionStorage.getItem(HIDDEN_AT) ?? 0);
      leftAt = sensitive ? Number(sessionStorage.getItem(SENSITIVE_LEFT) ?? 0) : 0;
    } catch {
      /* ignore */
    }
    const limit = config.timeoutMin * 60000;
    const away = (hiddenAt && Date.now() - hiddenAt > limit) || (leftAt && Date.now() - leftAt > limit);
    setLocked(!unlockedAt || Boolean(away));
    setCheckedFor(path);
  }, [config, here, sensitive, path]);

  // Private-screens lock: note when you leave them, so coming back later asks again.
  useEffect(() => {
    if (!sensitive) return;
    try {
      if (here) sessionStorage.removeItem(SENSITIVE_LEFT);
      else if (wasHere.current) sessionStorage.setItem(SENSITIVE_LEFT, String(Date.now()));
    } catch {
      /* ignore */
    }
    wasHere.current = here;
  }, [here, sensitive]);

  useEffect(() => {
    const t = window.setTimeout(evaluate, 0);
    const onVis = () => {
      try {
        if (document.visibilityState === "hidden") sessionStorage.setItem(HIDDEN_AT, String(Date.now()));
        else {
          evaluate();
          sessionStorage.removeItem(HIDDEN_AT);
        }
      } catch {
        /* ignore */
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [evaluate]);

  // Not checked yet on this kind of screen (first load, or just arrived on a private one).
  const stillChecking = config && here && (checkedFor === null || (sensitive && !onPaths(checkedFor, lockedPaths(config))));
  if (stillChecking) return <div className="fixed inset-0 z-[100] bg-bg" aria-hidden />;
  if (!locked || !config) return null;

  async function unlock() {
    setError(null);
    try {
      if (config!.method === "passkey" && config!.credId) await verifyPasskey(config!.credId);
      else if ((await hashPin(pin, config!.salt!)) !== config!.pinHash) throw new Error("Wrong PIN");
      markUnlocked(sensitive);
      setPin("");
      setLocked(false);
    } catch (e) {
      setError(config!.method === "pin" ? "Wrong PIN" : (e as Error).name === "NotAllowedError" ? "Cancelled. Try again." : "Couldn't verify. Try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-bg/95 p-6 text-center backdrop-blur-xl" role="dialog" aria-modal="true" aria-label="App locked">
      <LogoMark className="size-14" />
      <p className="text-lg font-semibold">{sensitive ? "This screen is locked" : "Hearth is locked"}</p>
      {sensitive ? <p className="-mt-2 text-sm text-fg-muted">Private screens ask first on this device.</p> : null}
      {config.method === "pin" ? (
        <form onSubmit={(e) => { e.preventDefault(); void unlock(); }} className="flex gap-2">
          <Input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" className="w-32 text-center tracking-widest" autoFocus aria-label="PIN" />
          <Button type="submit">Unlock</Button>
        </form>
      ) : (
        <Button onClick={unlock}>🔓 Unlock</Button>
      )}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {sensitive ? (
        <Link href="/" className="text-sm text-fg-muted underline">Back to Today</Link>
      ) : (
        <form action="/auth/signout" method="post">
          <button className="text-xs text-fg-muted underline">Sign out instead</button>
        </form>
      )}
    </div>
  );
}

export function AppLockSettings() {
  const raw = useConfig();
  const config = parseConfig(raw);
  const [timeout, setTimeoutMin] = useState(5);
  const [scope, setScope] = useState<"app" | "sensitive">("app");
  const [sections, setSections] = useState<string[]>(DEFAULT_SECTIONS);
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const passkeySupported = useSyncExternalStore(
    () => () => {},
    () => typeof window.PublicKeyCredential !== "undefined",
    () => false,
  );

  async function enablePasskey() {
    setMsg(null);
    try {
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge: rand(32),
          rp: { name: "Hearth", id: location.hostname },
          user: { id: rand(16), name: "hearth-app-lock", displayName: "Hearth app lock" },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;
      if (!cred) throw new Error("No credential");
      writeConfig({ method: "passkey", credId: b64(cred.rawId), timeoutMin: timeout, scope, sections });
      markUnlocked(scope === "sensitive");
      setMsg({ tone: "accent", text: "App lock is on for this device." });
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).name === "NotAllowedError" ? "Cancelled." : "This device couldn't set up a passkey. Use a PIN instead." });
    }
  }

  async function enablePin() {
    if (!/^\d{4,8}$/.test(pin)) return setMsg({ tone: "danger", text: "Use 4 to 8 digits." });
    const salt = b64(rand(16));
    if (scope === "sensitive" && !sections.length) return setMsg({ tone: "danger", text: "Pick at least one screen to lock." });
    writeConfig({ method: "pin", salt, pinHash: await hashPin(pin, salt), timeoutMin: timeout, scope, sections });
    markUnlocked(scope === "sensitive");
    setPin("");
    setMsg({ tone: "accent", text: "PIN lock is on for this device." });
  }

  if (config) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">
          ✓ On for {config.scope === "sensitive" ? LOCKABLE.filter((l) => (config.sections ?? DEFAULT_SECTIONS).includes(l.key)).map((l) => l.label).join(", ") : "the whole app"} ({config.method === "passkey" ? "fingerprint / face / device PIN" : "Hearth PIN"}), asks again after {config.timeoutMin} min away. To change it, turn it off and set it up again.
        </span>
        <Button size="sm" variant="ghost" onClick={async () => {
          try {
            if (config.method === "passkey" && config.credId) await verifyPasskey(config.credId);
            writeConfig(null);
            setMsg({ tone: "accent", text: "App lock turned off." });
          } catch {
            setMsg({ tone: "danger", text: "Verification needed to turn it off." });
          }
        }}>Turn off</Button>
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5 text-sm">
        <label className="flex items-center gap-2"><input type="radio" name="lock-scope" checked={scope === "app"} onChange={() => setScope("app")} className="accent-[var(--accent)]" /> The whole app</label>
        <label className="flex items-center gap-2"><input type="radio" name="lock-scope" checked={scope === "sensitive"} onChange={() => setScope("sensitive")} className="accent-[var(--accent)]" /> Only private screens</label>
        {scope === "sensitive" ? (
          <div className="ml-6 flex flex-wrap gap-x-4 gap-y-1">
            {LOCKABLE.map((l) => (
              <label key={l.key} className="flex items-center gap-1.5">
                <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={sections.includes(l.key)} onChange={(e) => setSections(e.target.checked ? [...sections, l.key] : sections.filter((k) => k !== l.key))} />
                {l.label}
              </label>
            ))}
          </div>
        ) : null}
      </div>
      <Field label={scope === "sensitive" ? "Ask again after being away from them for" : "Lock after the app has been away for"} className="w-64">
        <Select value={timeout} onChange={(e) => setTimeoutMin(Number(e.target.value))}>
          {[0, 1, 5, 15, 60].map((m) => (
            <option key={m} value={m}>{m === 0 ? "Immediately" : `${m} minute${m === 1 ? "" : "s"}`}</option>
          ))}
        </Select>
      </Field>
      <div className="flex flex-wrap items-end gap-2">
        {passkeySupported ? <Button onClick={enablePasskey} disabled={scope === "sensitive" && !sections.length}>Use fingerprint / face</Button> : null}
        <Field label="or a 4–8 digit PIN" className="w-40">
          <Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="new-password" />
        </Field>
        <Button variant="secondary" onClick={enablePin} disabled={!pin}>Use PIN</Button>
      </div>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
    </div>
  );
}
