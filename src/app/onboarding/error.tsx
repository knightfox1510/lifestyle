"use client"; // Error boundaries must be Client Components

import { ErrorScreen } from "@/components/error-screen";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} />;
}
