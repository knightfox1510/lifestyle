import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestUser } from "@/lib/ingest-auth";

const body = z.object({ name: z.string().min(1).max(300), modified: z.iso.datetime({ offset: true }).optional() });

/**
 * Step 1 of the daily Health Connect sync (called by the Google Apps Script
 * in your Drive). Says "skip" if this export was already imported, else
 * returns a one-time signed URL to upload the zip straight to private storage
 * (exports are too big to post through a Vercel function).
 */
export async function POST(request: Request) {
  const who = await ingestUser(request);
  if (!who) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { data: last } = await who.admin.from("health_connect_syncs").select("last_file, last_file_modified, last_status").eq("user_id", who.userId).maybeSingle();
  if (last?.last_status === "ok" && last.last_file === parsed.data.name && parsed.data.modified && last.last_file_modified && Date.parse(last.last_file_modified) >= Date.parse(parsed.data.modified)) {
    return NextResponse.json({ skip: true, reason: "Already imported this export." });
  }
  const path = `${who.userId}/${crypto.randomUUID()}.zip`;
  const { data, error } = await who.admin.storage.from("health-imports").createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: "Couldn't prepare the upload. Run the latest database update in Supabase." }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl, path });
}
