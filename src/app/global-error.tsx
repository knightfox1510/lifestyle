"use client"; // Error boundaries must be Client Components

import { GlobalErrorScreen } from "@/components/error-screen";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <GlobalErrorScreen error={error} retry={retry} />;
}
