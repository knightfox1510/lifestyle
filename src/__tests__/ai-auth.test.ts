import { describe, expect, it, vi } from "vitest";
import { MODELS, classifyAiError, modelChain, withRetry } from "@/lib/ai/retry";
import { safeNext } from "@/lib/auth-next";

describe("model chain", () => {
  it("follows the household choice, with a lighter fallback", () => {
    expect(modelChain("standard")).toEqual([MODELS.standard, MODELS.lite]);
    expect(modelChain("best")).toEqual([MODELS.best, MODELS.standard]);
    expect(modelChain(undefined)).toEqual([MODELS.standard, MODELS.lite]);
    expect(modelChain("best", "gemini-custom")).toEqual(["gemini-custom", MODELS.lite]);
    expect(modelChain("standard", MODELS.lite)).toEqual([MODELS.lite, MODELS.standard]);
  });
});

describe("error classification", () => {
  it("retries quota, busy and empty answers but not bad keys or safety blocks", () => {
    expect(classifyAiError({ status: 429, message: "RESOURCE_EXHAUSTED" })).toMatchObject({ kind: "quota", retry: true });
    expect(classifyAiError({ status: 503, message: "The model is overloaded" })).toMatchObject({ kind: "busy", retry: true });
    expect(classifyAiError(Object.assign(new Error("x"), { name: "EmptyResponse" }))).toMatchObject({ kind: "empty", retry: true });
    expect(classifyAiError({ status: 400, message: "API key not valid" })).toMatchObject({ kind: "key", retry: false });
    expect(classifyAiError({ status: 400, message: "Response blocked due to SAFETY" })).toMatchObject({ kind: "safety", retry: false });
    expect(classifyAiError({ status: 400, message: "INVALID_ARGUMENT" })).toMatchObject({ kind: "bad_request", retry: false });
  });
});

describe("withRetry time budget", () => {
  it("treats an aborted request as a timeout and doesn't retry it", async () => {
    expect(classifyAiError(Object.assign(new Error("This operation was aborted"), { name: "AbortError" }))).toMatchObject({ kind: "timeout", retry: false });
    const calls: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      withRetry(["a", "b"], async (m) => {
        calls.push(m);
        throw Object.assign(new Error("aborted"), { name: "AbortError" });
      }, { delays: [0, 0], deadline: Date.now() + 60_000 }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(calls).toEqual(["a"]);
    spy.mockRestore();
  });
  it("skips a retry that couldn't finish before the deadline", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const calls: string[] = [];
    await expect(
      withRetry(["a", "b"], async (m) => {
        calls.push(m);
        throw { status: 503, message: "UNAVAILABLE" };
      }, { delays: [0, 0], deadline: Date.now() + 5_000 }),
    ).rejects.toMatchObject({ status: 503 });
    expect(calls).toEqual(["a"]); // 5 s left is less than a useful attempt
    spy.mockRestore();
  });
  it("hands each attempt a signal that fires at the deadline", async () => {
    let got: AbortSignal | undefined;
    await withRetry(["a"], async (_m, signal) => { got = signal; return 1; }, { deadline: Date.now() + 30_000 });
    expect(got).toBeInstanceOf(AbortSignal);
  });
});

describe("withRetry", () => {
  const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});
  it("retries the same model, then falls back", async () => {
    const spy = quiet();
    const calls: string[] = [];
    const out = await withRetry(["a", "b"], async (m) => {
      calls.push(m);
      if (m === "a") throw { status: 503, message: "UNAVAILABLE" };
      return "ok";
    }, { delays: [0, 0] });
    expect(out).toEqual({ result: "ok", model: "b" });
    expect(calls).toEqual(["a", "a", "b"]);
    spy.mockRestore();
  });
  it("stops at once on a non-retryable error", async () => {
    const spy = quiet();
    const attempt = vi.fn(async () => { throw { status: 403, message: "PERMISSION_DENIED" }; });
    await expect(withRetry(["a", "b"], attempt, { delays: [0, 0] })).rejects.toMatchObject({ status: 403 });
    expect(attempt).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
  it("skips a model that doesn't exist", async () => {
    const spy = quiet();
    const calls: string[] = [];
    await withRetry(["gone", "b"], async (m) => {
      calls.push(m);
      if (m === "gone") throw { status: 404, message: "models/gone is not found" };
      return 1;
    }, { delays: [0, 0] });
    expect(calls).toEqual(["gone", "b"]);
    spy.mockRestore();
  });
});

describe("safeNext", () => {
  it("only allows same-site paths", () => {
    expect(safeNext("/join/abc?x=1")).toBe("/join/abc?x=1");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});

describe("stale deployment errors", () => {
  it("recognises errors a reload fixes", async () => {
    const { isStaleDeployError } = await import("@/components/error-screen");
    expect(isStaleDeployError(new Error('Failed to find Server Action "abc". This request might be from an older or newer deployment.'))).toBe(true);
    expect(isStaleDeployError(new Error("ChunkLoadError: Loading chunk 123 failed."))).toBe(true);
    expect(isStaleDeployError(new Error("Cannot read properties of undefined"))).toBe(false);
  });
});

describe("Gemini keys", () => {
  it("accepts both AQ. and AIza keys and cleans pasted ones", async () => {
    const { cleanGeminiKey, isPlausibleGeminiKey, classifyAiError } = await import("@/lib/ai/retry");
    const aq = "AQ.Ab8RN6Kx_example-Key.with.dots1234567890";
    expect(isPlausibleGeminiKey(aq)).toBe(true);
    expect(isPlausibleGeminiKey("AIzaSyA1234567890abcdefghijklmnopqrstu")).toBe(true);
    expect(isPlausibleGeminiKey("short")).toBe(false);
    expect(isPlausibleGeminiKey("has spaces in it 1234567890")).toBe(false);
    expect(cleanGeminiKey(` "${aq}"\n`)).toBe(aq);
    expect(cleanGeminiKey(undefined)).toBe("");
    expect(classifyAiError({ message: "ACCESS_TOKEN_TYPE_UNSUPPORTED" }).kind).toBe("key");
    expect(classifyAiError({ status: 401, message: "UNAUTHENTICATED" }).kind).toBe("key");
  });
});
