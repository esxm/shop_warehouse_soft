export default function FinancialReportLoading() {
  return (
    <div
      aria-label="Loading financial report"
      className="space-y-6"
      role="status"
    >
      <div className="h-44 animate-pulse rounded-3xl bg-slate-200" />
      <div className="h-56 animate-pulse rounded-3xl bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            className="h-32 animate-pulse rounded-2xl bg-slate-200"
            key={index}
          />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-3xl bg-slate-200" />
    </div>
  );
}
