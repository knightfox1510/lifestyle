"use client";

import { Button } from "@/components/ui";

export function PrintButton() {
  return (
    <Button size="sm" onClick={() => window.print()}>
      🖨️ Print / Save PDF
    </Button>
  );
}
