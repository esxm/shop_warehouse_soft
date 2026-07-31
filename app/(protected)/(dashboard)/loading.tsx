export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="space-y-6">
      <div className="h-44 animate-pulse rounded-3xl bg-slate-800" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }, (_, index) => (
          <div
            className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white"
            key={index}
          />
        ))}
      </div>
    </div>
  );
}
