"use client";

import { buttonClass } from "@/components/ui";

/** Signs out and wipes this device's cached pages (they may contain health data). */
export function SignOutButton() {
  return (
    <form
      action="/auth/signout"
      method="post"
      onSubmit={() => {
        navigator.serviceWorker?.controller?.postMessage("clear-user-data");
      }}
    >
      <button type="submit" className={buttonClass("danger")}>
        Sign out
      </button>
    </form>
  );
}
