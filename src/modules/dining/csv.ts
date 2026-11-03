/**
 * Menus as CSV, and long pasted menus split into parts for the AI
 * (pure; unit-tested).
 */

/** Parses CSV (quoted fields, "" escapes, commas/newlines inside quotes, ; or tab separators). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = [",", ";", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

export type CsvDish = {
  name: string;
  section: string | null;
  description: string | null;
  price: number | null;
  veg: boolean | null;
  serves: number;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

const COLS: Record<keyof CsvDish, RegExp> = {
  name: /^(dish|item|name|dish name|item name)$/,
  section: /^(section|category|course|menu section)$/,
  description: /^(description|details|desc)$/,
  price: /^(price|rate|mrp|cost|price \(₹\)|price inr|₹)$/,
  veg: /^(veg|type|veg\/non-veg|veg or non-veg|food type|diet)$/,
  serves: /^(serves|people)$/,
  calories: /^(calories|kcal|energy|cal)$/,
  protein_g: /^(protein|protein_g|protein \(g\))$/,
  carbs_g: /^(carbs|carbs_g|carbohydrates|carbs \(g\))$/,
  fat_g: /^(fat|fat_g|fats|fat \(g\))$/,
};

const numOrNull = (v: string | undefined) => {
  if (v == null) return null;
  const m = v.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

function vegOf(v: string | undefined): boolean | null {
  const s = (v ?? "").trim().toLowerCase();
  if (!s) return null;
  if (/non|egg|chicken|meat|fish|mutton|false|^no$|^n$|red/.test(s)) return false;
  if (/veg|true|^yes$|^y$|green|jain|vegan/.test(s)) return true;
  return null;
}

/** Dishes from a menu CSV with a header row. Columns are matched by name (Dish/Item/Name, Price, Section, Veg, Calories…). */
export function dishesFromCsv(text: string): CsvDish[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = Object.fromEntries(Object.entries(COLS).map(([k, re]) => [k, header.findIndex((h) => re.test(h))])) as Record<keyof CsvDish, number>;
  if (idx.name < 0) throw new Error("The CSV needs a column called Dish, Item or Name.");
  const at = (r: string[], k: keyof CsvDish) => (idx[k] >= 0 ? r[idx[k]]?.trim() : undefined);
  return rows
    .slice(1)
    .map((r) => ({
      name: (at(r, "name") ?? "").slice(0, 120),
      section: at(r, "section")?.slice(0, 80) || null,
      description: at(r, "description")?.slice(0, 300) || null,
      price: numOrNull(at(r, "price")),
      veg: vegOf(at(r, "veg")),
      serves: Math.min(10, Math.max(1, Math.round(numOrNull(at(r, "serves")) ?? 1))),
      calories: numOrNull(at(r, "calories")),
      protein_g: numOrNull(at(r, "protein_g")),
      carbs_g: numOrNull(at(r, "carbs_g")),
      fat_g: numOrNull(at(r, "fat_g")),
    }))
    .filter((d) => d.name);
}

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** A menu as CSV (opens in Excel/Sheets, and imports back into Hearth). */
export function menuToCsv(dishes: Partial<CsvDish>[]) {
  const head = ["Section", "Dish", "Price", "Veg", "Serves", "Calories", "Protein", "Carbs", "Fat", "Description"];
  const lines = dishes.map((d) => [d.section, d.name, d.price, d.veg == null ? "" : d.veg ? "veg" : "non-veg", d.serves ?? 1, d.calories, d.protein_g, d.carbs_g, d.fat_g, d.description].map(cell).join(","));
  return `﻿${[head.join(","), ...lines].join("\r\n")}\r\n`;
}

/**
 * Splits a long menu (pasted text or a whole web page) into parts of about
 * `size` characters on line breaks, so each part is a manageable job for the
 * AI and no dishes get dropped.
 */
export function splitMenuText(text: string, size = 4500): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l, i, a) => l.trim() || (i > 0 && a[i - 1].trim()));
  const parts: string[] = [];
  let cur: string[] = [];
  let len = 0;
  for (const line of lines) {
    if (len + line.length > size && cur.length) {
      parts.push(cur.join("\n"));
      cur = [];
      len = 0;
    }
    // A single huge line (no line breaks) is cut on its own.
    for (let i = 0; i < Math.max(1, Math.ceil(line.length / size)); i++) {
      const piece = line.slice(i * size, (i + 1) * size);
      cur.push(piece);
      len += piece.length + 1;
      if (len > size) {
        parts.push(cur.join("\n"));
        cur = [];
        len = 0;
      }
    }
  }
  if (cur.join("").trim()) parts.push(cur.join("\n"));
  return parts;
}
