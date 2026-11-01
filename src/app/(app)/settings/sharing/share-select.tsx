"use client";

import { useTransition } from "react";
import { Select } from "@/components/ui";
import { setShare } from "../actions";

export function ShareSelect({ granteeId, moduleKey, value }: { granteeId: string; moduleKey: string; value: "none" | "read" | "write" }) {
  const [pending, start] = useTransition();
  return (
    <Select
      aria-label="Access level"
      className="w-36 shrink-0"
      defaultValue={value}
      disabled={pending}
      onChange={(e) => {
        const level = e.target.value as "none" | "read" | "write";
        start(() => setShare(granteeId, moduleKey, level));
      }}
    >
      <option value="none">Private</option>
      <option value="read">Can view</option>
      <option value="write">Can edit</option>
    </Select>
  );
}
