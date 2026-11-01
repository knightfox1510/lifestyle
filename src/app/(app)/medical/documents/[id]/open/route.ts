import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

/** Short-lived signed URL so files are never publicly reachable. */
export async function GET(_request: Request, ctx: RouteContext<"/medical/documents/[id]/open">) {
  const { id } = await ctx.params;
  const session = await getSession();
  const { data: doc } = await session.supabase
    .from("medical_documents")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await session.supabase.storage
    .from("medical-documents")
    .createSignedUrl(doc.storage_path, 60);
  if (error || !data) return NextResponse.json({ error: "Couldn't open the file" }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
