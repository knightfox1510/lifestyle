import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets, the service worker, manifest and icons.
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|wasm)$).*)",
  ],
};
