"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { SwipeRow } from "@/components/swipe-row";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { useToast } from "@/components/toaster";
import { restockFromGroceries } from "@/app/(app)/pantry/actions";
import { createClient } from "@/lib/supabase/client";
import { cacheGetAll, cachePutMany, outboxAdd, outboxAll, outboxRemove } from "@/lib/offline/idb";
import { Badge, Button, Card, EmptyState, Input, Select, cx } from "@/components/ui";
import { GROCERY_CATEGORIES, type GroceryCategory, type GroceryItem } from "@/lib/types";
import { CATEGORY_META, guessCategory } from "@/modules/groceries/meta";

const COLLECTION = "grocery";
type Status = "synced" | "syncing" | "offline" | "error";

/** Fields the client is allowed to write (server fills the rest). */
function toRow(i: GroceryItem) {
  return {
    id: i.id,
    household_id: i.household_id,
    name: i.name,
    quantity: i.quantity,
    category: i.category,
    notes: i.notes,
    checked: i.checked,
    checked_by: i.checked_by,
    checked_at: i.checked_at,
    deleted_at: i.deleted_at,
  };
}

function newer(a: GroceryItem | undefined, b: GroceryItem) {
  return !a || b.updated_at >= a.updated_at;
}

export function GroceryList({
  householdId,
  userId,
  initialItems,
  names,
  pantryOn = false,
}: {
  householdId: string;
  userId: string;
  initialItems: GroceryItem[];
  names: Record<string, string>;
  pantryOn?: boolean;
}) {
  const t = useT();
  const { toast } = useToast();
  const router = useRouter();
  const [restocking, startRestock] = useTransition();
  const [items, setItems] = useState<Map<string, GroceryItem>>(() => new Map(initialItems.map((i) => [i.id, i])));
  const [status, setStatus] = useState<Status>("synced");
  const [pending, setPending] = useState(0);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [category, setCategory] = useState<GroceryCategory | "auto">("auto");
  const [showChecked, setShowChecked] = useState(false);
  const flushing = useRef(false);
  const supabase = useMemo(() => createClient(), []);

  const merge = useCallback((incoming: GroceryItem[]) => {
    setItems((prev) => {
      const next = new Map(prev);
      for (const i of incoming) if (i.household_id === householdId && newer(next.get(i.id), i)) next.set(i.id, i);
      return next;
    });
  }, [householdId]);

  /** Replays queued writes in order. Stops at the first network failure. */
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      const queue = await outboxAll<ReturnType<typeof toRow>>(COLLECTION);
      setPending(queue.length);
      if (!queue.length) {
        setStatus(navigator.onLine ? "synced" : "offline");
        return;
      }
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      setStatus("syncing");
      for (const entry of queue) {
        const { error } = await supabase.from("grocery_items").upsert(entry.value.row);
        if (error) {
          // A network failure leaves the queue for later; a rejected row (e.g. left the household) is dropped.
          if (error.message?.toLowerCase().includes("fetch")) {
            setStatus("offline");
            return;
          }
          console.warn("grocery sync rejected", error.message);
        }
        await outboxRemove(entry.key);
        setPending((p) => Math.max(0, p - 1));
      }
      setStatus("synced");
    } catch {
      setStatus(navigator.onLine ? "error" : "offline");
    } finally {
      flushing.current = false;
    }
  }, [supabase]);

  const refresh = useCallback(async () => {
    if (!navigator.onLine) return;
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { data, error } = await supabase
      .from("grocery_items")
      .select("*")
      .eq("household_id", householdId)
      .or(`deleted_at.is.null,updated_at.gt.${since}`);
    if (!error && data) {
      merge(data as GroceryItem[]);
      await cachePutMany(COLLECTION, data as GroceryItem[]);
    }
  }, [supabase, householdId, merge]);

  // Startup: cache → queued edits → server; then live updates.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = (await cacheGetAll<GroceryItem>(COLLECTION)).filter((i) => i.household_id === householdId);
      const queued = await outboxAll<ReturnType<typeof toRow>>(COLLECTION);
      if (cancelled) return;
      merge(cached);
      // Queued edits are the newest local truth until they reach the server.
      setItems((prev) => {
        const next = new Map(prev);
        for (const q of queued) {
          const base = next.get(q.value.row.id);
          next.set(q.value.row.id, { ...(base ?? ({} as GroceryItem)), ...q.value.row, updated_at: new Date().toISOString() } as GroceryItem);
        }
        return next;
      });
      await cachePutMany(COLLECTION, initialItems);
      await flush();
      await refresh();
    })();

    const channel = supabase
      .channel(`grocery:${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "grocery_items", filter: `household_id=eq.${householdId}` }, (payload) => {
        const row = payload.new as GroceryItem | undefined;
        if (row?.id) {
          merge([row]);
          void cachePutMany(COLLECTION, [row]);
        }
      })
      .subscribe();

    const online = () => void flush().then(refresh);
    const offline = () => setStatus("offline");
    const visible = () => document.visibilityState === "visible" && online();
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  /** Apply a local change, persist it to the cache and queue it for sync. */
  const change = useCallback(
    async (item: GroceryItem) => {
      const updated = { ...item, updated_at: new Date().toISOString() };
      setItems((prev) => new Map(prev).set(updated.id, updated));
      await cachePutMany(COLLECTION, [updated]);
      await outboxAdd(COLLECTION, toRow(updated));
      setPending((p) => p + 1);
      void flush();
    },
    [flush],
  );

  function add(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    void change({
      id: crypto.randomUUID(),
      household_id: householdId,
      created_by: userId,
      name: trimmed.slice(0, 120),
      quantity: qty.trim().slice(0, 40) || null,
      category: category === "auto" ? guessCategory(trimmed) : category,
      notes: null,
      checked: false,
      checked_by: null,
      checked_at: null,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    });
    setName("");
    setQty("");
    setCategory("auto");
  }

  const visible = [...items.values()].filter((i) => !i.deleted_at);
  const open = visible.filter((i) => !i.checked).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const done = visible.filter((i) => i.checked).sort((a, b) => (b.checked_at ?? "").localeCompare(a.checked_at ?? ""));
  const groups = GROCERY_CATEGORIES.map((c) => ({ c, list: open.filter((i) => i.category === c) })).filter((g) => g.list.length);

  const statusLabel =
    status === "offline"
      ? `Offline${pending ? ` · ${pending} change${pending === 1 ? "" : "s"} waiting` : ""}`
      : status === "syncing"
        ? "Syncing…"
        : status === "error"
          ? "Sync problem, will retry"
          : "Synced";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge tone={status === "synced" ? "accent" : status === "offline" ? "warn" : status === "error" ? "danger" : "neutral"}>
          {status === "offline" ? "📴" : status === "synced" ? "✓" : "↻"} {statusLabel}
        </Badge>
        <span className="text-sm text-fg-muted">{open.length} to buy</span>
      </div>

      <Card className="!p-3">
        <form onSubmit={add} className="flex flex-wrap gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add item, e.g. Milk" aria-label="Item" className="min-w-40 flex-[3]" maxLength={120} />
          <Input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" aria-label="Quantity" className="w-20 flex-1" maxLength={40} />
          <Select value={category} onChange={(e) => setCategory(e.target.value as GroceryCategory | "auto")} aria-label="Category" className="w-36 flex-1">
            <option value="auto">Auto category</option>
            {GROCERY_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_META[c].icon} {CATEGORY_META[c].label}</option>
            ))}
          </Select>
          <Button type="submit" disabled={!name.trim()}>Add</Button>
        </form>
      </Card>

      {open.length === 0 && done.length === 0 ? (
        <EmptyState title="The list is empty">Add what you need; your partner sees it instantly.</EmptyState>
      ) : null}

      {groups.map((g) => (
        <section key={g.c}>
          <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            {CATEGORY_META[g.c].icon} {CATEGORY_META[g.c].label}
          </h2>
          <ul className="space-y-1.5">
            {g.list.map((i) => (
              <Row key={i.id} item={i} names={names} userId={userId} onChange={change} />
            ))}
          </ul>
        </section>
      ))}

      {done.length ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <button className="text-sm font-medium text-fg-muted" onClick={() => setShowChecked(!showChecked)} aria-expanded={showChecked}>
              {showChecked ? "▾" : "▸"} In the cart ({done.length})
            </button>
            <span className="flex flex-wrap justify-end gap-1">
              {pantryOn ? (
                <Button
                  size="sm"
                  variant="soft"
                  pending={restocking}
                  onClick={() =>
                    startRestock(async () => {
                      if (!navigator.onLine) return toast(t("You're offline. Put things in the pantry once you're back online."), { tone: "error" });
                      const r = await restockFromGroceries(done.map((i) => i.id));
                      if (r.error) return toast(r.error, { tone: "error" });
                      const now = new Date().toISOString();
                      setItems((m) => new Map([...m].map(([id, i]) => [id, done.some((d) => d.id === id) ? { ...i, deleted_at: now, updated_at: now } : i])));
                      toast(r.message ?? t("Put in the pantry."));
                      router.refresh();
                    })
                  }
                >
                  {t("Put in pantry & clear")}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  for (const i of done) void change({ ...i, deleted_at: new Date().toISOString() });
                }}
              >
                {pantryOn ? t("Just clear") : t("Clear cart")}
              </Button>
            </span>
          </div>
          {showChecked ? (
            <ul className="space-y-1.5">
              {done.map((i) => (
                <Row key={i.id} item={i} names={names} userId={userId} onChange={change} />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function Row({
  item,
  names,
  userId,
  onChange,
}: {
  item: GroceryItem;
  names: Record<string, string>;
  userId: string;
  onChange: (i: GroceryItem) => Promise<void>;
}) {
  const by = item.checked ? item.checked_by : item.created_by;
  const who = by && by !== userId ? names[by] : null;
  const [editing, setEditing] = useState(false);
  const [eName, setEName] = useState(item.name);
  const [eQty, setEQty] = useState(item.quantity ?? "");
  const [eCat, setECat] = useState<GroceryCategory>(item.category);
  if (editing) {
    return (
      <li className="rounded-xl border border-accent/40 bg-surface px-3 py-2">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!eName.trim()) return;
            void onChange({ ...item, name: eName.trim().slice(0, 120), quantity: eQty.trim().slice(0, 40) || null, category: eCat });
            setEditing(false);
          }}
        >
          <Input value={eName} onChange={(e) => setEName(e.target.value)} aria-label="Item" className="!h-9 min-w-32 flex-[3]" maxLength={120} autoFocus />
          <Input value={eQty} onChange={(e) => setEQty(e.target.value)} aria-label="Quantity" placeholder="Qty" className="!h-9 w-20 flex-1" maxLength={40} />
          <Select value={eCat} onChange={(e) => setECat(e.target.value as GroceryCategory)} aria-label="Category" className="!h-9 w-36 flex-1">
            {GROCERY_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_META[c].icon} {CATEGORY_META[c].label}</option>
            ))}
          </Select>
          <Button type="submit" size="sm">Save</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </form>
      </li>
    );
  }
  const toggle = () =>
    void onChange({
      ...item,
      checked: !item.checked,
      checked_by: !item.checked ? userId : null,
      checked_at: !item.checked ? new Date().toISOString() : null,
    });
  return (
    <SwipeRow className="rounded-xl" right={{ label: item.checked ? "Put back" : "Got it", icon: <Check className="size-4" aria-hidden />, onAction: toggle }} left={{ label: "Remove", onAction: () => void onChange({ ...item, deleted_at: new Date().toISOString() }) }}>
    <div className={cx("flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2", item.checked && "opacity-60")}>
      <button
        type="button"
        aria-pressed={item.checked}
        aria-label={`${item.checked ? "Uncheck" : "Check"} ${item.name}`}
        onClick={() =>
          void onChange({
            ...item,
            checked: !item.checked,
            checked_by: !item.checked ? userId : null,
            checked_at: !item.checked ? new Date().toISOString() : null,
          })
        }
        className={cx(
          "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
          item.checked ? "border-accent bg-accent text-accent-fg" : "border-border",
        )}
      >
        {item.checked ? "✓" : ""}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cx("truncate", item.checked && "line-through")}>
          {item.name} {item.quantity ? <span className="text-fg-muted">· {item.quantity}</span> : null}
        </p>
        {who || item.reason ? (
          <p className="text-xs text-fg-muted">
            {item.reason ? <span className="mr-1.5 rounded-full bg-surface-2 px-1.5 py-0.5">{item.reason === "staple" ? "★ staple" : item.reason === "running_low" ? "running low" : "ran out"}</span> : null}
            {who ? (item.checked ? `picked up by ${who}` : `added by ${who}`) : null}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        aria-label={`Edit ${item.name}`}
        className="px-1 text-xs text-fg-muted hover:text-fg"
        onClick={() => {
          setEName(item.name);
          setEQty(item.quantity ?? "");
          setECat(item.category);
          setEditing(true);
        }}
      >
        ✎
      </button>
      <button
        type="button"
        aria-label={`Remove ${item.name}`}
        className="px-1 text-fg-muted hover:text-danger"
        onClick={() => void onChange({ ...item, deleted_at: new Date().toISOString() })}
      >
        ✕
      </button>
    </div>
    </SwipeRow>
  );
}
