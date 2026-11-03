import { NextResponse } from "next/server";

/** Used by the first version of the sync script, which uploaded the whole export (too big past 50 MB). */
export async function POST() {
  return NextResponse.json({ error: "This sync script is out of date. In Hearth → Wearables → Health Connect, tap “Make my sync script”, paste the new script over the old one and run setup again." }, { status: 410 });
}
