"use client";

export default function DashboardError({
  unstable_retry,
}: Readonly<{
  error: Error & { digest?: string };
  unstable_retry: () => void;
}>) {
  return (
    <section className="rounded-3xl border border-red-200 bg-red-50 p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-red-950">
        Dashboard could not be loaded
      </h1>
      <p className="mt-2 text-sm leading-6 text-red-900">
        The current financial values are temporarily unavailable. No data was
        changed.
      </p>
      <button
        className="mt-5 rounded-xl bg-red-900 px-5 py-3 font-semibold text-white"
        onClick={() => unstable_retry()}
        type="button"
      >
        Try again
      </button>
    </section>
  );
}
