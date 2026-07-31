export default function DailySalesLoading() {
  return (
    <div aria-label="Loading daily sales" className="space-y-6" role="status">
      <div className="h-44 animate-pulse rounded-3xl bg-slate-200" />
      <div className="h-96 animate-pulse rounded-3xl bg-slate-200" />
      <div className="h-72 animate-pulse rounded-3xl bg-slate-200" />
    </div>
  );
}
