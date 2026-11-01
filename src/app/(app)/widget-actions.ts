"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { DEFAULT_WIDGETS, WIDGET_BY_KEY } from "@/modules/widgets";
import type { UserWidget, WidgetSize } from "@/lib/types";

async function load() {
  const session = await getSession();
  const { data } = await session.supabase.from("user_widgets").select("*").eq("user_id", session.userId).order("position");
  let widgets = (data ?? []) as UserWidget[];
  if (widgets.length === 0) {
    // First customisation: materialise the defaults so they can be edited.
    const { data: created } = await session.supabase
      .from("user_widgets")
      .insert(DEFAULT_WIDGETS.map((key, i) => ({ widget_key: key, position: i, size: WIDGET_BY_KEY[key].defaultSize })))
      .select("*");
    widgets = ((created ?? []) as UserWidget[]).sort((a, b) => a.position - b.position);
  }
  return { session, widgets };
}

function done() {
  revalidatePath("/");
  revalidatePath("/customize");
}

export async function addWidget(key: string) {
  if (!WIDGET_BY_KEY[key]) return;
  const { session, widgets } = await load();
  if (widgets.some((w) => w.widget_key === key)) return;
  await session.supabase.from("user_widgets").insert({
    widget_key: key,
    position: widgets.length,
    size: WIDGET_BY_KEY[key].defaultSize,
  });
  done();
}

export async function removeWidget(key: string) {
  const { session } = await load();
  await session.supabase.from("user_widgets").delete().eq("user_id", session.userId).eq("widget_key", key);
  done();
}

export async function moveWidget(key: string, direction: -1 | 1) {
  const { session, widgets } = await load();
  const i = widgets.findIndex((w) => w.widget_key === key);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= widgets.length) return;
  await Promise.all([
    session.supabase.from("user_widgets").update({ position: j }).eq("id", widgets[i].id),
    session.supabase.from("user_widgets").update({ position: i }).eq("id", widgets[j].id),
  ]);
  done();
}

export async function resizeWidget(key: string, size: WidgetSize) {
  if (!["sm", "md", "lg"].includes(size)) return;
  const { session } = await load();
  await session.supabase.from("user_widgets").update({ size }).eq("user_id", session.userId).eq("widget_key", key);
  done();
}

export async function resetWidgets() {
  const session = await getSession();
  await session.supabase.from("user_widgets").delete().eq("user_id", session.userId);
  done();
}
