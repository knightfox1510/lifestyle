import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A server file that imports a plain value (a list, a helper) from a
 * "use client" module gets only a reference on the server, so using it
 * crashes the page ("Something went wrong"). Components are fine.
 */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

describe("client/server boundary", () => {
  it("server files only import components (not values) from client modules", () => {
    const all = files("src").filter((f) => !f.includes("__tests__"));
    const isClient = (s: string) => /^\s*["']use client["']/.test(s);
    const clientValues = new Map<string, string[]>();
    for (const f of all) {
      const s = readFileSync(f, "utf8");
      if (!isClient(s)) continue;
      const names = [...s.matchAll(/^export (?:const|let|var|function) ([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
      const values = names.filter((n) => n === n.toUpperCase() || (/^[a-z]/.test(n) && !n.startsWith("use")));
      if (values.length) clientValues.set(f.replace(/\.(ts|tsx)$/, ""), values);
    }
    const problems: string[] = [];
    for (const f of all) {
      const s = readFileSync(f, "utf8");
      if (isClient(s)) continue;
      for (const m of s.matchAll(/import \{([^}]*)\} from ["']([^"']+)["']/g)) {
        const spec = m[2];
        const target = spec.startsWith("@/") ? join("src", spec.slice(2)) : spec.startsWith(".") ? normalize(join(dirname(f), spec)) : null;
        const values = target ? clientValues.get(target) : undefined;
        if (!values) continue;
        const imported = m[1].split(",").map((x) => x.trim().replace(/^type\s+/, "").split(" as ")[0]).filter(Boolean);
        const typeOnly = new Set(m[1].split(",").map((x) => x.trim()).filter((x) => x.startsWith("type ")).map((x) => x.slice(5).split(" as ")[0]));
        for (const name of imported) if (values.includes(name) && !typeOnly.has(name)) problems.push(`${f} imports ${name} from ${spec}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
