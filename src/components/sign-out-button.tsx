"use client";

import { buttonClass } from "@/components/ui";
import { clearAll } from "@/lib/offline/idb";

/** Signs out and wipes this device's cached pages (they may contain health data). */
export function SignOutButton() {
  return (
    <form
      action="/auth/signout"
      method="post"
      onSubmit={async (e) => {
        // Wipe this device's offline copies (they can contain health data) before leaving.
        e.preventDefault();
        const form = e.currentTarget;
        navigator.serviceWorker?.controller?.postMessage("clear-user-data");
        await clearAll();
        form.submit();
      }}
    >
      <button type="submit" className={buttonClass("danger")}>
        Sign out
      </button>
    </form>
  );
}
