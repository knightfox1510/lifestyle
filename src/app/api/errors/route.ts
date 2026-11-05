import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAppError } from "@/lib/error-log";

const body = z.object({ message: z.string().max(2000), path: z.string().max(1000).optional(), digest: z.string().max(200).optional(), stack: z.string().max(8000).optional() });

/** Errors from the browser (crashed screens, unhandled errors). Signed-in users only, at most 30 an hour each. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const { count } = await createAdminClient().from("app_errors").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", new Date(Date.now() - 36e5).toISOString());
  if ((count ?? 0) >= 30) return NextResponse.json({ ok: true, dropped: true });
  await logAppError({ source: "client", userId, ...parsed.data, userAgent: request.headers.get("user-agent") });
  return NextResponse.json({ ok: true });
}
