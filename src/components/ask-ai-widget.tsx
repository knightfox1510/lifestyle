"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input } from "@/components/ui";

export function AskAiWidget() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/assistant?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What should I cook tonight?" aria-label="Question" />
      <Button type="submit">Ask</Button>
    </form>
  );
}
