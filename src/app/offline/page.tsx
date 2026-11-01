export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="text-5xl" aria-hidden>📡</div>
      <h1 className="text-xl font-semibold">You&apos;re offline</h1>
      <p className="text-sm text-fg-muted">
        Pages you opened recently are still available. Anything else will load when you&apos;re back online.
      </p>
    </main>
  );
}
